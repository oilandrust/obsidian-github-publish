import { App, Modal, Notice, Setting } from 'obsidian';
import { pollWorkflowRun, repoActionsUrl } from '../github/actions';
import { PublishResult } from '../publish/initialPublish';
import { ProgressPhase, ProgressState } from '../settings';
import { childDiv, childEl, childSpan, addCopyButton } from './dom';

export type ProgressModalMode = 'full' | 'incremental';

export interface ProgressModalOptions {
  mode?: ProgressModalMode;
  onFinished?: () => void;
  actionsListUrl?: string;
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
  private actionsListUrl?: string;

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
    this.actionsListUrl = options?.actionsListUrl;
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

      this.actionsListUrl = repoActionsUrl(result.owner, result.repo);

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

  private getSteps(): { label: string; phases: ProgressPhase[] }[] {
    if (this.options?.mode === 'incremental') {
      return [
        { label: 'Detect changes', phases: ['preparing'] },
        { label: 'Upload changed files', phases: ['uploading'] },
        { label: 'Build site (GitHub Actions)', phases: ['waiting-build'] },
        { label: 'Deploy to GitHub Pages', phases: ['waiting-deploy'] },
        { label: 'Site is live', phases: ['done'] },
      ];
    }

    return [
      {
        label: 'Create and configure repository',
        phases: ['preparing', 'creating-repo', 'configuring-pages'],
      },
      {
        label: 'Commit and push files',
        phases: ['uploading', 'waiting-build', 'waiting-deploy'],
      },
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
    childEl(contentEl, 'h2', { text: title });
    this.renderSubtitle(contentEl);

    const steps = childDiv(contentEl, { cls: 'github-publish-steps' });
    const progressSteps = this.getSteps();
    const activePhase = this.state.phase === 'error' ? this.lastActivePhase : this.state.phase;
    const currentIndex =
      this.state.phase === 'done'
        ? progressSteps.length
        : progressSteps.findIndex((step) => step.phases.includes(activePhase));

    for (let i = 0; i < progressSteps.length; i++) {
      const progressStep = progressSteps[i];
      if (!progressStep) continue;
      const { label } = progressStep;
      const row = childDiv(steps, { cls: 'github-publish-step' });
      const icon = childSpan(row, { cls: 'github-publish-step-icon' });

      if (this.state.phase === 'error' && i === currentIndex) {
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

      childSpan(row, { text: label });
    }

    childEl(contentEl, 'p', { text: this.state.message });

    if (this.state.uploadTotal) {
      const progressLabel =
        this.options?.mode === 'incremental' ? 'Processed' : 'Prepared';
      childEl(contentEl, 'p', {
        text: `${progressLabel} ${String(this.state.uploadCurrent ?? 0)} / ${String(this.state.uploadTotal)} files`,
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
      const errorText = this.state.error ?? '';
      const copyText = [this.state.message, errorText].filter(Boolean).join('\n\n');
      const errorRow = childDiv(contentEl, { cls: 'github-publish-error-row' });
      childEl(errorRow, 'p', { cls: 'github-publish-step-error', text: errorText });
      addCopyButton(errorRow, copyText, {
        ariaLabel: 'Copy error message',
        successNotice: 'Error copied to clipboard',
      });
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

  private renderSubtitle(container: HTMLElement): void {
    const subtitle = childDiv(container, { cls: 'github-publish-progress-subtitle' });
    childEl(subtitle, 'p', {
      text: 'It can take up to a few minutes, especially the first time.',
    });

    if (!this.actionsListUrl) {
      return;
    }

    const linkRow = childDiv(subtitle, { cls: 'github-publish-actions-link-row' });
    const link = childEl(linkRow, 'a', {
      cls: 'github-publish-actions-link',
      href: this.actionsListUrl,
      text: 'monitor github actions',
    });
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }

  private renderLiveUrlRow(container: HTMLElement, liveUrl: string): void {
    const row = childDiv(container, { cls: 'github-publish-live-url-row' });
    const link = childEl(row, 'a', {
      cls: 'github-publish-live-link',
      href: liveUrl,
      text: liveUrl,
    });
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    addCopyButton(row, liveUrl, {
      ariaLabel: 'Copy site URL',
      successNotice: 'Site URL copied to clipboard',
    });
  }
}
