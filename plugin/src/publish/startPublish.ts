import { Notice } from 'obsidian';
import GitHubPublishPlugin from '../../main';
import { SetupConfig } from '../settings';
import { runInitialPublish } from './initialPublish';
import { ProgressModal } from '../ui/ProgressModal';

export function saveSetupConfig(plugin: GitHubPublishPlugin, config: SetupConfig): void {
  plugin.settings.savedSetup = config;
  plugin.settings.siteName = config.siteName;
  plugin.settings.contentFolder = config.contentFolder;
  void plugin.saveSettings();
}

export function getSavedSetup(plugin: GitHubPublishPlugin): SetupConfig | null {
  return plugin.settings.savedSetup;
}

export function startPublish(plugin: GitHubPublishPlugin, config?: SetupConfig): void {
  const token = plugin.settings.accessToken;
  const username = plugin.settings.githubUsername;

  if (!token || !username) {
    new Notice('Connect to GitHub in plugin settings first.');
    return;
  }

  const publishConfig = config ?? plugin.settings.savedSetup;
  if (!publishConfig) {
    new Notice('No saved publish setup. Run the setup wizard first.');
    return;
  }

  saveSetupConfig(plugin, publishConfig);

  const pluginDir = plugin.getPluginDir();
  const progress = new ProgressModal(
    plugin.app,
    token,
    (onProgress) =>
      runInitialPublish(plugin.app, pluginDir, token, username, publishConfig, onProgress),
    async (result) => {
      plugin.settings.owner = result.owner;
      plugin.settings.repo = result.repo;
      plugin.settings.siteName = publishConfig.siteName;
      plugin.settings.contentFolder = publishConfig.contentFolder;
      plugin.settings.lastPublishedCommitSha = result.commitSha;
      plugin.settings.manifest = result.manifest;
      await plugin.saveSettings();
      new Notice(`Site published: ${result.liveUrl}`);
    },
  );

  progress.open();
}
