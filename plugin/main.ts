import { App, ButtonComponent, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { fetchGitHubUser } from './src/github/auth';
import { connectGitHub } from './src/github/connect';
import { checkPublishStatus, StatusCheck } from './src/github/publishStatus';
import {
  DEFAULT_SETTINGS,
  getPublishedLiveUrl,
  getPublishedRepoUrl,
  isSitePublished,
  PluginSettings,
} from './src/settings';
import { SetupModal } from './src/ui/SetupModal';
import { getPluginDir } from './src/publish/initialPublish';
import { detectUnpublishedChanges } from './src/publish/publishChanges';
import { startPublish, startPublishChanges } from './src/publish/startPublish';
import { countDiffChanges } from './src/publish/diffVault';

export default class GitHubPublishPlugin extends Plugin {
  settings: PluginSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new GitHubPublishSettingTab(this.app, this));

    this.addCommand({
      id: 'setup-site',
      name: 'Set up site',
      callback: () => new SetupModal(this.app, this).open(),
    });

    this.addCommand({
      id: 'continue-publish',
      name: 'Continue publish',
      callback: () => startPublish(this),
    });

    this.addCommand({
      id: 'publish-changes',
      name: 'Publish changes',
      callback: () => startPublishChanges(this),
    });

    this.addRibbonIcon('globe', 'GitHub Publish setup', () => {
      new SetupModal(this.app, this).open();
    });
  }

  async loadSettings(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  getPluginDir(): string {
    return getPluginDir(this.app, this.manifest.id);
  }

  async setAccessToken(token: string) {
    const user = await fetchGitHubUser(token);
    this.settings.accessToken = token;
    this.settings.githubUsername = user.login;
    await this.saveSettings();
    return user;
  }
}

class GitHubPublishSettingTab extends PluginSettingTab {
  private connecting = false;
  private deviceUserCode: string | null = null;
  private statusCheckId = 0;

  constructor(app: App, private readonly plugin: GitHubPublishPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    this.statusCheckId++;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'GitHub Publish' });

    containerEl.createEl('p', {
      text: 'Create a GitHub OAuth App at github.com/settings/developers with no callback URL required for device flow. Enter its Client ID below. Login requests repo and workflow scopes (workflow is required to push commits that include .github/workflows/).',
    });

    new Setting(containerEl)
      .setName('OAuth App Client ID')
      .setDesc('Required for GitHub device login.')
      .addText((text) =>
        text
          .setPlaceholder('Ov23li…')
          .setValue(this.plugin.settings.clientId)
          .onChange(async (value) => {
            this.plugin.settings.clientId = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    const connected = Boolean(this.plugin.settings.accessToken);
    new Setting(containerEl)
      .setName('GitHub account')
      .setDesc(this.plugin.settings.githubUsername ?? 'Not connected')
      .addButton((btn) => {
        if (connected) {
          btn.setButtonText('Disconnect');
          btn.onClick(async () => {
            this.plugin.settings.accessToken = null;
            this.plugin.settings.githubUsername = null;
            await this.plugin.saveSettings();
            this.display();
          });
        } else {
          btn.setButtonText(this.connecting ? 'Connecting…' : 'Connect to GitHub').setCta();
          btn.setDisabled(this.connecting);
          btn.onClick(() => {
            this.connecting = true;
            this.deviceUserCode = null;
            this.display();
            void connectGitHub(this.plugin, {
              onUserCode: (code) => {
                this.deviceUserCode = code;
                this.display();
              },
            })
              .then((user) => {
                new Notice(`Connected as ${user.login}`);
                this.connecting = false;
                this.deviceUserCode = null;
                this.display();
              })
              .catch((error: unknown) => {
                new Notice(error instanceof Error ? error.message : String(error));
                this.connecting = false;
                this.deviceUserCode = null;
                this.display();
              });
          });
        }
      });

    if (this.connecting) {
      if (this.deviceUserCode) {
        containerEl.createEl('p', { text: 'Enter this code on GitHub:' });
        containerEl.createEl('div', {
          cls: 'github-publish-device-code',
          text: this.deviceUserCode,
        });
        containerEl.createEl('p', { text: 'Waiting for authorization…' });
      } else {
        containerEl.createEl('p', { text: 'Requesting device code…' });
      }
    }

    if (isSitePublished(this.plugin.settings)) {
      this.renderPublishedSite(containerEl);
    } else {
      const saved = this.plugin.settings.savedSetup;
      if (saved) {
        this.renderSavedSetup(containerEl, saved);
      }
    }

    new Setting(containerEl).addButton((btn) =>
      btn.setButtonText('Open setup wizard').onClick(() => {
        new SetupModal(this.app, this.plugin).open();
      }),
    );
  }

  private renderPublishedSite(containerEl: HTMLElement): void {
    const { settings } = this.plugin;
    const liveUrl = getPublishedLiveUrl(settings);
    const repoUrl = getPublishedRepoUrl(settings);
    const checkId = this.statusCheckId;

    containerEl.createEl('h3', { text: 'Published site' });
    const summary = containerEl.createEl('dl', { cls: 'github-publish-summary' });
    this.addSummaryRow(summary, 'Site name', settings.siteName ?? '—');
    this.addSummaryRow(summary, 'Vault folder', settings.contentFolder ?? '—');

    summary.createEl('dt', { text: 'Repository' });
    const repoValue = summary.createEl('dd');
    const repoStatus = repoValue.createSpan({ cls: 'github-publish-status github-publish-status-checking' });
    repoStatus.setText('Checking…');
    if (repoUrl) {
      repoValue.createEl('br');
      const link = repoValue.createEl('a', {
        cls: 'github-publish-live-link',
        href: repoUrl,
        text: repoUrl,
      });
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }

    summary.createEl('dt', { text: 'Live site' });
    const liveValue = summary.createEl('dd');
    const liveStatus = liveValue.createSpan({ cls: 'github-publish-status github-publish-status-checking' });
    liveStatus.setText('Checking…');
    if (liveUrl) {
      liveValue.createEl('br');
      const link = liveValue.createEl('a', {
        cls: 'github-publish-live-link',
        href: liveUrl,
        text: liveUrl,
      });
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }

    summary.createEl('dt', { text: 'Changes' });
    const changesValue = summary.createEl('dd');
    const changesStatus = changesValue.createSpan({
      cls: 'github-publish-status github-publish-status-checking',
    });
    changesStatus.setText('Checking for changes…');

    let publishChangesBtn: ButtonComponent | null = null;
    const publishChangesSetting = new Setting(containerEl).addButton((btn) => {
      publishChangesBtn = btn;
      btn.setButtonText('Publish changes').setCta();
      btn.setDisabled(true);
      btn.onClick(() => {
        if (!this.plugin.settings.accessToken) {
          new Notice('Connect to GitHub in settings first.');
          return;
        }
        startPublishChanges(this.plugin);
      });
    });

    if (liveUrl && settings.owner && settings.repo) {
      void checkPublishStatus(settings.accessToken, settings.owner, settings.repo, liveUrl).then(
        (result) => {
          if (checkId !== this.statusCheckId) return;
          this.applyStatusCheck(repoStatus, result.repository);
          this.applyStatusCheck(liveStatus, result.liveSite);
        },
      );
    }

    if (settings.contentFolder) {
      void detectUnpublishedChanges(this.plugin.app, settings).then((result) => {
        if (checkId !== this.statusCheckId) return;
        if (!result) {
          changesStatus.removeClass('github-publish-status-checking');
          changesStatus.addClass('github-publish-status-error');
          changesStatus.setText('Unable to check for changes');
          return;
        }

        const hasChanges = countDiffChanges(result.diff) > 0;
        changesStatus.removeClass(
          'github-publish-status-checking',
          'github-publish-status-live',
          'github-publish-status-unreachable',
        );
        changesStatus.addClass(
          hasChanges ? 'github-publish-changes-pending' : 'github-publish-status-live',
        );
        changesStatus.setText(result.summary);

        publishChangesBtn?.setDisabled(!hasChanges);
        publishChangesSetting.setDesc(
          hasChanges ? 'Unpublished changes detected in your vault folder.' : '',
        );
      });
    }
  }

  private applyStatusCheck(element: HTMLElement, check: StatusCheck): void {
    element.removeClass('github-publish-status-checking', 'github-publish-status-live', 'github-publish-status-unreachable', 'github-publish-status-error');
    element.addClass(`github-publish-status-${check.status}`);
    const statusLabel =
      check.status === 'live'
        ? 'Live'
        : check.status === 'unreachable'
          ? 'Unreachable'
          : check.status === 'error'
            ? 'Error'
            : 'Checking…';
    element.setText(`${statusLabel} — ${check.detail}`);
  }

  private renderSavedSetup(containerEl: HTMLElement, saved: NonNullable<PluginSettings['savedSetup']>): void {
    containerEl.createEl('h3', { text: 'Saved setup' });
    const summary = containerEl.createEl('dl', { cls: 'github-publish-summary' });
    this.addSummaryRow(summary, 'Site name', saved.siteName);
    this.addSummaryRow(summary, 'Vault folder', saved.contentFolder);
    this.addSummaryRow(
      summary,
      'Repository',
      saved.repoMode === 'create' ? `Create: ${saved.repoName}` : `Existing: ${saved.repoName}`,
    );

    new Setting(containerEl).addButton((btn) =>
      btn.setButtonText('Continue publish').setCta().onClick(() => {
        if (!this.plugin.settings.accessToken) {
          new Notice('Connect to GitHub in settings first.');
          return;
        }
        startPublish(this.plugin);
      }),
    );
  }

  private addSummaryRow(dl: HTMLElement, label: string, value: string): void {
    dl.createEl('dt', { text: label });
    dl.createEl('dd', { text: value || '—' });
  }
}
