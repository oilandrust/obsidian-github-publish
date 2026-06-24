import { App, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { fetchGitHubUser } from './src/github/auth';
import { connectGitHub } from './src/github/connect';
import { DEFAULT_SETTINGS, PluginSettings } from './src/settings';
import { SetupModal } from './src/ui/SetupModal';
import { getPluginDir } from './src/publish/initialPublish';
import { startPublish } from './src/publish/startPublish';

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

  constructor(app: App, private readonly plugin: GitHubPublishPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
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

    if (this.plugin.settings.repo && this.plugin.settings.owner) {
      containerEl.createEl('h3', { text: 'Published site' });
      containerEl.createEl('p', {
        text: `https://${this.plugin.settings.owner}.github.io/${this.plugin.settings.repo}/`,
      });
    }

    const saved = this.plugin.settings.savedSetup;
    if (saved) {
      containerEl.createEl('h3', { text: 'Saved setup' });
      const summary = containerEl.createEl('dl', { cls: 'github-publish-summary' });
      this.addSummaryRow(summary, 'Site name', saved.siteName);
      this.addSummaryRow(summary, 'Vault folder', saved.contentFolder);
      this.addSummaryRow(
        summary,
        'Repository',
        saved.repoMode === 'create' ? `Create: ${saved.repoName}` : `Existing: ${saved.repoName}`,
      );
      this.addSummaryRow(
        summary,
        'Live URL',
        `https://${this.plugin.settings.githubUsername ?? 'user'}.github.io/${saved.repoName}/`,
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

    new Setting(containerEl).addButton((btn) =>
      btn.setButtonText('Open setup wizard').onClick(() => {
        new SetupModal(this.app, this.plugin).open();
      }),
    );
  }

  private addSummaryRow(dl: HTMLElement, label: string, value: string): void {
    dl.createEl('dt', { text: label });
    dl.createEl('dd', { text: value || '—' });
  }
}
