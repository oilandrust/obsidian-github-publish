import { Notice } from 'obsidian';
import GitHubPublishPlugin from '../../main';
import { log } from '../log';
import { isSitePublished, SetupConfig } from '../settings';
import { countDiffChanges } from './diffVault';
import { runInitialPublish } from './initialPublish';
import { detectUnpublishedChanges, runPublishChanges } from './publishChanges';
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
    { mode: 'full' },
  );

  progress.open();
}

export function startPublishChanges(plugin: GitHubPublishPlugin): void {
  log('Publish changes requested');
  const token = plugin.settings.accessToken;

  if (!token) {
    new Notice('Connect to GitHub in plugin settings first.');
    return;
  }

  if (!isSitePublished(plugin.settings)) {
    new Notice('Complete initial publish before publishing changes.');
    return;
  }

  const progress = new ProgressModal(
    plugin.app,
    token,
    (onProgress) => runPublishChanges(plugin.app, token, plugin.settings, onProgress),
    async (result) => {
      plugin.settings.lastPublishedCommitSha = result.commitSha;
      plugin.settings.manifest = result.manifest;
      await plugin.saveSettings();
      new Notice(`Changes published: ${result.liveUrl}`);
    },
    { mode: 'incremental' },
  );

  progress.open();
}

export async function hasUnpublishedChanges(plugin: GitHubPublishPlugin): Promise<boolean> {
  if (!isSitePublished(plugin.settings) || !plugin.settings.contentFolder) {
    return false;
  }

  const result = await detectUnpublishedChanges(plugin.app, plugin.settings);
  if (!result) return false;
  return countDiffChanges(result.diff) > 0;
}
