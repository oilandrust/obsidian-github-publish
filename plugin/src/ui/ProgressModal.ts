import { App, Modal, Setting } from 'obsidian';
import { pollWorkflowRun } from '../github/actions';
import { PublishResult } from '../publish/initialPublish';
import { ProgressPhase, ProgressState } from '../settings';

export class ProgressModal extends Modal {
  private state: ProgressState = {
    phase: 'preparing',
    message: 'Starting…',
  };
  private lastActivePhase: ProgressPhase = 'preparing';

  constructor(
    app: App,
    private readonly token: string,
    private readonly publishTask: (
      onProgress: (state: Partial<ProgressState>) => void,
    ) => Promise<PublishResult>,
    private readonly onComplete: (result: PublishResult) => Promise<void>,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('github-publish-modal');
    this.render();
    void this.run();
  }

  private async run(): Promise<void> {
    try {
      const result = await this.publishTask((update) => {
        if (update.phase && update.phase !== 'error') {
          this.lastActivePhase = update.phase;
        }
        this.state = { ...this.state, ...update };
        this.render();
      });

      this.state = {
        phase: 'waiting-build',
        message: 'Waiting for GitHub Actions build…',
      };
      this.render();

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
          this.render();
        },
      );

      this.state = {
        phase: 'done',
        message: 'Your site is live!',
        liveUrl: result.liveUrl,
      };
      this.render();

      await this.onComplete(result);
    } catch (error) {
      this.state = {
        phase: 'error',
        message: 'Publish failed',
        error: error instanceof Error ? error.message : String(error),
      };
      this.render();
    }
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('github-publish-modal');

    contentEl.createEl('h2', { text: 'Publishing to GitHub Pages' });

    const steps = contentEl.createDiv({ cls: 'github-publish-steps' });
    const phases: { phase: ProgressPhase; label: string }[] = [
      { phase: 'preparing', label: 'Prepare files' },
      { phase: 'creating-repo', label: 'Create repository' },
      { phase: 'configuring-pages', label: 'Configure GitHub Pages' },
      { phase: 'uploading', label: 'Create single Git commit' },
      { phase: 'waiting-build', label: 'Build site (GitHub Actions)' },
      { phase: 'waiting-deploy', label: 'Deploy to GitHub Pages' },
      { phase: 'done', label: 'Site is live' },
    ];

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
      contentEl.createEl('p', {
        text: `Prepared ${this.state.uploadCurrent ?? 0} / ${this.state.uploadTotal} files`,
      });
    }

    if (this.state.phase === 'done' && this.state.liveUrl) {
      contentEl.createEl('p', { cls: 'github-publish-live-url', text: this.state.liveUrl });
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
      btn.setButtonText('Run in background').onClick(() => this.close()),
    );
  }
}
