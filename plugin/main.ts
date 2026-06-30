import { App, Plugin, PluginSettingTab } from 'obsidian';
import { fetchGitHubUser } from './src/github/auth';
import { connectGitHub } from './src/github/connect';
import {
  DEFAULT_SETTINGS,
  PluginSettings,
  TemplateEngine,
} from './src/settings';
import { migratePluginSettings } from './src/sites';
import { SetupModal } from './src/ui/SetupModal';
import { PublishedSiteCard } from './src/ui/PublishedSiteCard';
import { SitePickerModal } from './src/ui/SitePickerModal';
import { ProgressModal } from './src/ui/ProgressModal';
import { getPluginDir } from './src/publish/initialPublish';
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
import { childDiv, childEl } from './src/ui/dom';
import { elEmpty } from './src/ui/element';
import { openModal } from './src/ui/modalApi';
import { showNotice } from './src/ui/notices';
import {
  pluginAddCommand,
  pluginAddRibbonIcon,
  pluginAddSettingTab,
  savePluginData,
} from './src/ui/pluginApi';
import { addSetting } from './src/ui/settingsUi';
import { loadPluginSettingsData } from './src/utils/pluginData';

export default class GitHubPublishPlugin extends Plugin {
  settings: PluginSettings = DEFAULT_SETTINGS;
  private publishingSiteIds = new Set<string>();
  private settingTab: GitHubPublishSettingTab | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.settingTab = new GitHubPublishSettingTab(this.app, this);
    pluginAddSettingTab(this, this.settingTab);

    pluginAddCommand(this, {
      id: 'setup-site',
      name: 'Set up site',
      callback: () => {
        this.openSetupWizard();
      },
    });

    pluginAddCommand(this, {
      id: 'continue-publish',
      name: 'Continue publish',
      callback: () => {
        startPublish(this);
      },
    });

    pluginAddCommand(this, {
      id: 'publish-changes',
      name: 'Publish changes',
      callback: () => {
        this.openPublishChangesPicker();
      },
    });

    pluginAddRibbonIcon(this, 'globe', 'GitHub Publish setup', () => {
      this.openSetupWizard();
    });
  }

  async loadSettings(): Promise<void> {
    const stored = await loadPluginSettingsData(this);
    this.settings = migratePluginSettings({ ...DEFAULT_SETTINGS, ...stored });
  }

  async saveSettings(): Promise<void> {
    await savePluginData(this, this.settings);
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
      showNotice('Connect to GitHub in plugin settings first.');
      return;
    }
    openModal(new SetupModal(this.app, this));
  }

  openPublishChangesPicker(): void {
    const sites = getPublishableSites(this);
    if (sites.length === 0) {
      showNotice('Complete initial publish before publishing changes.');
      return;
    }

    if (sites.length === 1) {
      const site = sites[0];
      if (site) startPublishChanges(this, site);
      return;
    }

    openModal(
      new SitePickerModal(this.app, sites, (site) => {
        startPublishChanges(this, site);
      }),
    );
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
    elEmpty(containerEl);

    const connected = Boolean(this.plugin.settings.accessToken);

    if (!connected) {
      childEl(containerEl, 'p', {
        text: 'Connect your GitHub account to start publishing your vault or a specific folder. Authorization uses repo and workflow scopes.',
      });
    }

    addSetting(containerEl)
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
                showNotice(`Connected as ${user.login}`);
                this.connecting = false;
                this.deviceUserCode = null;
                this.display();
              })
              .catch((error: unknown) => {
                showNotice(error instanceof Error ? error.message : String(error));
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
        childEl(containerEl, 'div', {
          cls: 'github-publish-device-code',
          text: this.deviceUserCode,
        });
        childEl(containerEl, 'p', { text: 'Waiting for authorization…' });
      } else {
        childEl(containerEl, 'p', { text: 'Requesting device code…' });
      }
    }

    if (showAdvancedSettings) {
      this.renderAdvancedSettings(containerEl);
    }

    addSetting(containerEl)
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
      addSetting(containerEl).setName('Published sites').setHeading();
      const sitesContainer = childDiv(containerEl, { cls: 'github-publish-sites-list' });
      for (const site of publishedSites) {
        new PublishedSiteCard(
          this.app,
          this.plugin,
          site,
          isStale,
          (selected) => startPublishChanges(this.plugin, selected),
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
    addSetting(containerEl).setName('Advanced').setHeading();

    addSetting(containerEl)
      .setName('Template engine')
      .setDesc('Quartz is recommended for Obsidian features like wikilinks, graph, and backlinks.')
      .addDropdown((dropdown) => {
        dropdown
          .addOption('quartz', 'Quartz')
          .addOption('inhouse', 'Built-in')
          .setValue(this.plugin.settings.templateEngine ?? 'quartz')
          .onChange(async (value) => {
            this.plugin.settings.templateEngine = value as TemplateEngine;
            await this.plugin.saveSettings();
            this.display();
          });
      });

    if ((this.plugin.settings.templateEngine ?? 'quartz') === 'quartz') {
      const activeSha = resolveQuartzCommitSha(this.plugin.settings.quartzCommitSha);
      const isKnownSha = TESTED_QUARTZ_VERSIONS.some((version) => version.sha === activeSha);
      const dropdownValue = isKnownSha ? activeSha : 'custom';

      addSetting(containerEl)
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
              this.plugin.settings.quartzCommitSha = value;
            }
            await this.plugin.saveSettings();
            this.display();
          });
        });

      if (dropdownValue === 'custom') {
        addSetting(containerEl)
          .setName('Custom Quartz commit SHA')
          .setDesc(`Leave blank to use the plugin default (${DEFAULT_QUARTZ_COMMIT.slice(0, 7)}).`)
          .addText((text) => {
            text
              .setPlaceholder(DEFAULT_QUARTZ_COMMIT)
              .setValue(this.plugin.settings.quartzCommitSha ?? '')
              .onChange(async (value: string) => {
                this.plugin.settings.quartzCommitSha = value.trim() || null;
                await this.plugin.saveSettings();
              });
          });
      }
    }
  }

  private renderSavedSetup(containerEl: HTMLElement, saved: NonNullable<PluginSettings['savedSetup']>): void {
    addSetting(containerEl).setName('Saved setup').setHeading();
    const summary = childEl(containerEl, 'dl', { cls: 'github-publish-summary' });
    this.addSummaryRow(summary, 'Site name', saved.siteName);
    this.addSummaryRow(summary, 'Vault folder', saved.contentFolder);
    this.addSummaryRow(
      summary,
      'Repository',
      saved.repoMode === 'create' ? `Create: ${saved.repoName}` : `Existing: ${saved.repoName}`,
    );

    addSetting(containerEl).addButton((btn) => {
      btn.setButtonText('Continue publish').setCta();
      btn.onClick(() => {
        if (!this.plugin.settings.accessToken) {
          showNotice('Connect to GitHub in settings first.');
          return;
        }
        startPublish(this.plugin);
      });
    });
  }

  private addSummaryRow(dl: HTMLElement, label: string, value: string): void {
    childEl(dl, 'dt', { text: label });
    childEl(dl, 'dd', { text: value || '—' });
  }
}
