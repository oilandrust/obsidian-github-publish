import { App, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { fetchGitHubUser } from './src/github/auth';
import { connectGitHub } from './src/github/connect';
import {
  DEFAULT_SETTINGS,
  PluginSettings,
  PublishedSite,
} from './src/settings';
import { migratePluginSettings, removePublishedSite } from './src/sites';
import { SetupModal } from './src/ui/SetupModal';
import { PublishedSiteCard } from './src/ui/PublishedSiteCard';
import { SitePickerModal } from './src/ui/SitePickerModal';
import { ProgressModal } from './src/ui/ProgressModal';
import {
  getPublishableSites,
  startPublish,
  startPublishChanges,
} from './src/publish/startPublish';
import {
  DEFAULT_QUARTZ_COMMIT,
  resolveQuartzCommitSha,
  TESTED_QUARTZ_VERSIONS,
} from './src/quartz/versions';
import { showAdvancedSettings } from './src/buildFlags';
import { childDiv, childEl, addCopyButton } from './src/ui/dom';
import { loadPluginSettingsData } from './src/utils/pluginData';

export default class GitHubPublishPlugin extends Plugin {
  settings: PluginSettings = DEFAULT_SETTINGS;
  private publishingSiteIds = new Set<string>();
  private settingTab: GitHubPublishSettingTab | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.settingTab = new GitHubPublishSettingTab(this.app, this);
    this.addSettingTab(this.settingTab);

    this.addCommand({
      id: 'setup-site',
      name: 'Set up site',
      callback: () => this.openSetupWizard(),
    });

    this.addCommand({
      id: 'continue-publish',
      name: 'Continue publish',
      callback: () => startPublish(this),
    });

    this.addCommand({
      id: 'publish-changes',
      name: 'Publish changes',
      callback: () => this.openPublishChangesPicker(),
    });

    this.addRibbonIcon('globe', 'GitHub Publish setup', () => {
      this.openSetupWizard();
    });
  }

  async loadSettings(): Promise<void> {
    const stored = await loadPluginSettingsData(this);
    this.settings = migratePluginSettings({ ...DEFAULT_SETTINGS, ...stored });
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async setAccessToken(token: string) {
    const user = await fetchGitHubUser(token);
    this.settings.accessToken = token;
    this.settings.githubUsername = user.login;
    await this.saveSettings();
    return user;
  }

  markSitePublishing(siteId: string): void {
    this.publishingSiteIds.add(siteId);
    this.refreshSettingsTab();
  }

  clearSitePublishing(siteId: string): void {
    this.publishingSiteIds.delete(siteId);
    this.refreshSettingsTab();
  }

  isSitePublishing(siteId: string): boolean {
    return this.publishingSiteIds.has(siteId);
  }

  refreshSettingsTab(): void {
    this.settingTab?.display();
  }

  openSetupWizard(): void {
    if (!this.settings.accessToken) {
      new Notice('Connect to GitHub in plugin settings first.');
      return;
    }
    if (this.settings.savedSetup) {
      this.settings.savedSetup = null;
      void this.saveSettings();
      this.refreshSettingsTab();
    }
    new SetupModal(this.app, this).open();
  }

  openPublishChangesPicker(): void {
    const sites = getPublishableSites(this);
    if (sites.length === 0) {
      new Notice('Complete initial publish before publishing changes.');
      return;
    }

    if (sites.length === 1) {
      const site = sites[0];
      if (site) startPublishChanges(this, site);
      return;
    }

    new SitePickerModal(this.app, sites, (site) => {
      startPublishChanges(this, site);
    }).open();
  }

  async untrackPublishedSite(site: PublishedSite): Promise<void> {
    this.settings.publishedSites = removePublishedSite(this.settings.publishedSites, site.id);
    await this.saveSettings();
    this.refreshSettingsTab();
    new Notice(`Stopped tracking ${site.siteName}`);
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
    const checkId = this.statusCheckId;
    const isStale = () => checkId !== this.statusCheckId;
    containerEl.empty();

    const connected = Boolean(this.plugin.settings.accessToken);

    if (!connected) {
      childEl(containerEl, 'p', {
        text: 'Connect your GitHub account to start publishing your vault or a specific folder. Authorization uses repo and workflow scopes.',
      });
    }

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
        childEl(containerEl, 'p', { text: 'Enter this code on GitHub:' });
        const codeRow = childDiv(containerEl, { cls: 'github-publish-device-code-row' });
        childEl(codeRow, 'div', {
          cls: 'github-publish-device-code',
          text: this.deviceUserCode,
        });
        addCopyButton(codeRow, this.deviceUserCode, {
          ariaLabel: 'Copy device code',
          successNotice: 'Device code copied to clipboard',
        });
        childEl(containerEl, 'p', { text: 'Waiting for authorization…' });
      } else {
        childEl(containerEl, 'p', { text: 'Requesting device code…' });
      }
    }

    if (showAdvancedSettings) {
      this.renderAdvancedSettings(containerEl);
    }

    //this.renderDevelopmentSettings(containerEl);

    new Setting(containerEl)
      .setName('Publish new site')
      .setDesc('Choose a vault folder and GitHub repository to publish.')
      .addButton((btn) => {
        btn.setButtonText('Start Setup');
        if (connected) {
          btn.setCta();
        } else {
          btn.setDisabled(true);
        }
        btn.onClick(() => {
          this.plugin.openSetupWizard();
        });
      });

    const { publishedSites } = this.plugin.settings;
    if (publishedSites.length > 0) {
      new Setting(containerEl).setName('Published sites').setHeading();
      const sitesContainer = childDiv(containerEl, { cls: 'github-publish-sites-list' });
      for (const site of publishedSites) {
        new PublishedSiteCard(
          this.app,
          this.plugin,
          site,
          isStale,
          (selected) => startPublishChanges(this.plugin, selected),
          (selected) => {
            void this.plugin.untrackPublishedSite(selected);
          },
        ).render(sitesContainer);
      }
    } else {
      const saved = this.plugin.settings.savedSetup;
      if (saved) {
        this.renderSavedSetup(containerEl, saved);
      }
    }
  }

  private renderAdvancedSettings(containerEl: HTMLElement): void {
    new Setting(containerEl).setName('Advanced').setHeading();

    const activeSha = resolveQuartzCommitSha(this.plugin.settings.quartzCommitSha);
    const isKnownSha = TESTED_QUARTZ_VERSIONS.some((version) => version.sha === activeSha);
    const dropdownValue = isKnownSha ? activeSha : 'custom';

    new Setting(containerEl)
      .setName('Quartz version')
      .setDesc('Pinned Quartz commit used when publishing a new site.')
      .addDropdown((dropdown) => {
        for (const version of TESTED_QUARTZ_VERSIONS) {
          dropdown.addOption(version.sha, version.label);
        }
        dropdown.addOption('custom', 'Custom commit…');
        dropdown.setValue(dropdownValue).onChange(async (value: string) => {
          if (value === 'custom') {
            this.plugin.settings.quartzCommitSha = isKnownSha ? '' : activeSha;
          } else {
            const sha: string = value;
            this.plugin.settings.quartzCommitSha = sha;
          }
          await this.plugin.saveSettings();
          this.display();
        });
      });

    if (dropdownValue === 'custom') {
      new Setting(containerEl)
        .setName('Custom Quartz commit SHA')
        .setDesc(`Leave blank to use the plugin default (${DEFAULT_QUARTZ_COMMIT.slice(0, 7)}).`)
        .addText((text) => {
          text
            .setPlaceholder(DEFAULT_QUARTZ_COMMIT)
            .setValue(this.plugin.settings.quartzCommitSha ?? '')
            .onChange(async (value: string) => {
              const trimmed: string = value.trim();
              this.plugin.settings.quartzCommitSha = trimmed || null;
              await this.plugin.saveSettings();
            });
        });
    }
  }

  private renderDevelopmentSettings(containerEl: HTMLElement): void {
    new Setting(containerEl).setName('Development').setHeading();

    new Setting(containerEl)
      .setName('Preview publish success')
      .setDesc('Open the success screen with mock data for githubpublish-wiki.')
      .addButton((btn) =>
        btn.setButtonText('Preview').onClick(() => {
          ProgressModal.openDonePreview(this.app, {
            mode: 'incremental',
            liveUrl: 'https://oilandrust.github.io/githubpublish-wiki/',
          });
        }),
      );
  }

  private renderSavedSetup(containerEl: HTMLElement, saved: NonNullable<PluginSettings['savedSetup']>): void {
    new Setting(containerEl).setName('Saved setup').setHeading();
    const summary = childEl(containerEl, 'dl', { cls: 'github-publish-summary' });
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
    childEl(dl, 'dt', { text: label });
    childEl(dl, 'dd', { text: value || '—' });
  }
}
