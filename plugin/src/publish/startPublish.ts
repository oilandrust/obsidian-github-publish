import { Notice } from 'obsidian';
import GitHubPublishPlugin from '../../main';
import { log } from '../log';
import { PublishedSite, SetupConfig } from '../settings';
import { resolveQuartzCommitSha } from '../quartz/versions';
import {
  isPublishedSite,
  publishedSiteFromPublishResult,
  siteId,
  updatePublishedSite,
  upsertPublishedSite,
} from '../sites';
import { countDiffChanges } from './diffVault';
import { runInitialPublish } from './initialPublish';
import { detectUnpublishedChanges, runPublishChanges } from './publishChanges';
import { ProgressModal } from '../ui/ProgressModal';

export function saveSetupConfig(plugin: GitHubPublishPlugin, config: SetupConfig): void {
  plugin.settings.savedSetup = config;
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

  const publishConfig = withTemplateSettings(config ?? plugin.settings.savedSetup, plugin);
  if (!publishConfig) {
    new Notice('No saved publish setup. Run the setup wizard first.');
    return;
  }

  saveSetupConfig(plugin, publishConfig);

  const publishingId = siteId(username, publishConfig.repoName);
  if (plugin.isSitePublishing(publishingId)) {
    new Notice('Publish already in progress for this site.');
    return;
  }

  plugin.markSitePublishing(publishingId);

  const pluginDir = plugin.getPluginDir();
  const progress = new ProgressModal(
    plugin.app,
    token,
    (onProgress) =>
      runInitialPublish(plugin.app, pluginDir, token, username, publishConfig, onProgress),
    async (result) => {
      const site = publishedSiteFromPublishResult(
        publishConfig,
        result.owner,
        result.repo,
        result.commitSha,
        result.manifest,
      );
      plugin.settings.publishedSites = upsertPublishedSite(plugin.settings.publishedSites, site);
      plugin.settings.savedSetup = null;
      await plugin.saveSettings();
      new Notice(`Site published: ${result.liveUrl}`);
    },
    {
      mode: 'full',
      onFinished: () => plugin.clearSitePublishing(publishingId),
    },
  );

  progress.open();
}

export function startPublishChanges(plugin: GitHubPublishPlugin, site: PublishedSite): void {
  log('Publish changes requested', { siteId: site.id });
  const token = plugin.settings.accessToken;

  if (!token) {
    new Notice('Connect to GitHub in plugin settings first.');
    return;
  }

  if (!isPublishedSite(site)) {
    new Notice('Complete initial publish before publishing changes.');
    return;
  }

  if (plugin.isSitePublishing(site.id)) {
    new Notice('Publish already in progress for this site.');
    return;
  }

  plugin.markSitePublishing(site.id);

  const progress = new ProgressModal(
    plugin.app,
    token,
    (onProgress) => runPublishChanges(plugin.app, token, site, onProgress),
    async (result) => {
      plugin.settings.publishedSites = updatePublishedSite(
        plugin.settings.publishedSites,
        site.id,
        {
          lastPublishedCommitSha: result.commitSha,
          manifest: result.manifest,
        },
      );
      await plugin.saveSettings();
      new Notice(`Changes published: ${result.liveUrl}`);
    },
    {
      mode: 'incremental',
      onFinished: () => plugin.clearSitePublishing(site.id),
    },
  );

  progress.open();
}

export async function hasUnpublishedChanges(
  plugin: GitHubPublishPlugin,
  site: PublishedSite,
): Promise<boolean> {
  if (!isPublishedSite(site) || !site.contentFolder) {
    return false;
  }

  const result = await detectUnpublishedChanges(plugin.app, site);
  if (!result) return false;
  return countDiffChanges(result.diff) > 0;
}

export function getPublishableSites(plugin: GitHubPublishPlugin): PublishedSite[] {
  return plugin.settings.publishedSites.filter(isPublishedSite);
}

function withTemplateSettings(
  config: SetupConfig | null,
  plugin: GitHubPublishPlugin,
): SetupConfig | null {
  if (!config) return null;

  return {
    ...config,
    templateEngine: config.templateEngine ?? plugin.settings.templateEngine ?? 'quartz',
    quartzCommitSha:
      config.quartzCommitSha ??
      plugin.settings.quartzCommitSha ??
      resolveQuartzCommitSha(null),
  };
}
