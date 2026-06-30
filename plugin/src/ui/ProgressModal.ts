import { App, Modal, Notice, Setting } from 'obsidian';
import { pollWorkflowRun } from '../github/actions';
import { PublishResult } from '../publish/initialPublish';
import { ProgressPhase, ProgressState } from '../settings';

export type ProgressModalMode = 'full' | 'incremental';

export interface ProgressModalOptions {
  mode?: ProgressModalMode;
  onFinished?: () => void;
  /** Render a fixed state without running publish (development preview). */
  previewState?: ProgressState;
}

export class ProgressModal extends Modal {
  private state: ProgressState = {
    phase: 'preparing',
    message: 'Starting…',
  };
  private lastActivePhase: ProgressPhase = 'preparing';
  private runningInBackground = false;

  constructor(
    app: App,
    private readonly token: string,
    private readonly publishTask: (
      onProgress: (state: Partial<ProgressState>) => void,
    ) => Promise<PublishResult>,
    private readonly onComplete: (result: PublishResult) => Promise<void>,
    private readonly options?: ProgressModalOptions,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('github-publish-modal');

    if (this.options?.previewState) {
      this.state = { ...this.options.previewState };
      this.lastActivePhase = this.state.phase === 'error' ? 'preparing' : this.state.phase;
      this.render();
      return;
    }

    this.render();
    void this.run();
  }

  /** Open the success screen with mock data for UI development. */
  static openDonePreview(
    app: App,
    options: { mode?: ProgressModalMode; liveUrl: string; message?: string },
  ): void {
    new ProgressModal(
      app,
      '',
      async () => {
        throw new Error('ProgressModal preview does not run publish.');
      },
      () => Promise.resolve(),
      {
        mode: options.mode,
        previewState: {
          phase: 'done',
          message: options.message ?? 'Your site is live!',
          liveUrl: options.liveUrl,
        },
      },
    ).open();
  }

  private async run(): Promise<void> {
    try {
      const result = await this.publishTask((update) => {
        if (update.phase && update.phase !== 'error') {
          this.lastActivePhase = update.phase;
        }
        this.state = { ...this.state, ...update };
        if (!this.runningInBackground) {
          this.render();
        }
      });

      this.state = {
        phase: 'waiting-build',
        message: 'Waiting for GitHub Actions build…',
      };
      if (!this.runningInBackground) {
        this.render();
      }

      await pollWorkflowRun(
        this.token,
        result.owner,
        result.repo,
        result.commitSha,
        (run) => {
          if (!run) {
            this.state = {
              phase: 'waiting-build',
              message: 'Waiting for workflow to start…',
            };
          } else if (run.status !== 'completed') {
            this.state = {
              phase: 'waiting-deploy',
              message: 'Building and deploying site…',
              actionsUrl: run.html_url,
            };
          }
          if (!this.runningInBackground) {
            this.render();
          }
        },
      );

      this.state = {
        phase: 'done',
        message: 'Your site is live!',
        liveUrl: result.liveUrl,
      };
      if (!this.runningInBackground) {
        this.render();
      }

      await this.onComplete(result);
      if (this.runningInBackground) {
        new Notice(`GitHub Publish: site updated — ${result.liveUrl}`);
      }
    } catch (error: unknown) {
      this.state = {
        phase: 'error',
        message: 'Publish failed',
        error: error instanceof Error ? error.message : String(error),
      };
      if (!this.runningInBackground) {
        this.render();
      } else {
        new Notice(
          `GitHub Publish failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } finally {
      this.options?.onFinished?.();
    }
  }

  private getPhases(): { phase: ProgressPhase; label: string }[] {
    if (this.options?.mode === 'incremental') {
      return [
        { phase: 'preparing', label: 'Detect changes' },
        { phase: 'uploading', label: 'Upload changed files' },
        { phase: 'waiting-build', label: 'Build site (GitHub Actions)' },
        { phase: 'waiting-deploy', label: 'Deploy to GitHub Pages' },
        { phase: 'done', label: 'Site is live' },
      ];
    }

    return [
      { phase: 'preparing', label: 'Prepare files' },
      { phase: 'creating-repo', label: 'Create repository' },
      { phase: 'configuring-pages', label: 'Configure GitHub Pages' },
      { phase: 'uploading', label: 'Create single Git commit' },
      { phase: 'waiting-build', label: 'Build site (GitHub Actions)' },
      { phase: 'waiting-deploy', label: 'Deploy to GitHub Pages' },
      { phase: 'done', label: 'Site is live' },
    ];
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('github-publish-modal');

    const title =
      this.options?.mode === 'incremental'
        ? 'Publishing changes to GitHub Pages'
        : 'Publishing to GitHub Pages';
    contentEl.createEl('h2', { text: title });

    const steps = contentEl.createDiv({ cls: 'github-publish-steps' });
    const phases = this.getPhases();

    const order = phases.map((p) => p.phase);
    const failedIndex =
      this.state.phase === 'error' ? order.indexOf(this.lastActivePhase) : -1;
    const currentIndex =
      this.state.phase === 'error' ? failedIndex : order.indexOf(this.state.phase);

    for (let i = 0; i < phases.length; i++) {
      const { label } = phases[i];
      const row = steps.createDiv({ cls: 'github-publish-step' });
      const icon = row.createSpan({ cls: 'github-publish-step-icon' });

      if (this.state.phase === 'error' && i === failedIndex) {
        row.addClass('github-publish-step-error');
        icon.setText('✗');
      } else if (i < currentIndex || this.state.phase === 'done') {
        row.addClass('github-publish-step-done');
        icon.setText('✓');
      } else if (i === currentIndex) {
        row.addClass('github-publish-step-active');
        icon.setText('…');
      } else {
        row.addClass('github-publish-step-pending');
        icon.setText('○');
      }

      row.createSpan({ text: label });
    }

    contentEl.createEl('p', { text: this.state.message });

    if (this.state.uploadTotal) {
      const progressLabel =
        this.options?.mode === 'incremental' ? 'Processed' : 'Prepared';
      contentEl.createEl('p', {
        text: `${progressLabel} ${this.state.uploadCurrent ?? 0} / ${this.state.uploadTotal} files`,
      });
    }

    if (this.state.phase === 'done' && this.state.liveUrl) {
      this.renderLiveUrlRow(contentEl, this.state.liveUrl);
      new Setting(contentEl)
        .addButton((btn) =>
          btn.setButtonText('Open site').setCta().onClick(() => window.open(this.state.liveUrl)),
        )
        .addButton((btn) => btn.setButtonText('Close').onClick(() => this.close()));
      return;
    }

    if (this.state.phase === 'error') {
      contentEl.createEl('p', { cls: 'github-publish-step-error', text: this.state.error ?? '' });
      if (this.state.actionsUrl) {
        new Setting(contentEl).addButton((btn) =>
          btn.setButtonText('View Actions run').onClick(() => window.open(this.state.actionsUrl)),
        );
      }
      new Setting(contentEl).addButton((btn) => btn.setButtonText('Close').onClick(() => this.close()));
      return;
    }

    new Setting(contentEl).addButton((btn) =>
      btn.setButtonText('Continue in background').onClick(() => {
        this.runningInBackground = true;
        new Notice('Publishing in background — you will be notified when it finishes.');
        this.close();
      }),
    );
  }

  private renderLiveUrlRow(container: HTMLElement, liveUrl: string): void {
    const row = container.createDiv({ cls: 'github-publish-live-url-row' });
    const link = row.createEl('a', {
      cls: 'github-publish-live-link',
      href: liveUrl,
      text: liveUrl,
    });
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    const copyBtn = row.createEl('button', {
      cls: 'clickable-icon github-publish-copy-url',
    });
    copyBtn.setAttr('aria-label', 'Copy site URL');
    copyBtn.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
    copyBtn.addEventListener('click', () => {
      void navigator.clipboard.writeText(liveUrl).then(
        () => new Notice('Site URL copied to clipboard'),
        () => new Notice('Could not copy URL'),
      );
    });
  }
}
