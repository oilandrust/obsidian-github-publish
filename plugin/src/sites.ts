import { PluginSettings, PublishedSite, SetupConfig } from './settings';

export interface LegacyPluginSettings extends PluginSettings {
  owner?: string | null;
  repo?: string | null;
  siteName?: string | null;
  contentFolder?: string | null;
  lastPublishedCommitSha?: string | null;
  manifest?: Record<string, string>;
}

export function siteId(owner: string, repo: string): string {
  return `${owner}/${repo}`;
}

export function getSiteLiveUrl(site: PublishedSite): string {
  return `https://${site.owner}.github.io/${site.repo}/`;
}

export function getSiteRepoUrl(site: PublishedSite): string {
  return `https://github.com/${site.owner}/${site.repo}`;
}

export function isPublishedSite(site: PublishedSite): boolean {
  return Boolean(site.owner && site.repo && site.lastPublishedCommitSha);
}

export function hasPublishedSites(settings: PluginSettings): boolean {
  return settings.publishedSites.some(isPublishedSite);
}

export function publishedSiteFromPublishResult(
  config: SetupConfig,
  owner: string,
  repo: string,
  commitSha: string,
  manifest: Record<string, string>,
): PublishedSite {
  return {
    id: siteId(owner, repo),
    owner,
    repo,
    siteName: config.siteName,
    contentFolder: config.contentFolder,
    lastPublishedCommitSha: commitSha,
    manifest,
    templateEngine: config.templateEngine ?? 'quartz',
    quartzCommitSha: config.quartzCommitSha ?? null,
  };
}

export function upsertPublishedSite(
  sites: PublishedSite[],
  site: PublishedSite,
): PublishedSite[] {
  const index = sites.findIndex((entry) => entry.id === site.id);
  if (index === -1) {
    return [...sites, site];
  }

  const next = [...sites];
  next[index] = site;
  return next;
}

export function updatePublishedSite(
  sites: PublishedSite[],
  id: string,
  update: Partial<PublishedSite>,
): PublishedSite[] {
  return sites.map((site) => (site.id === id ? { ...site, ...update } : site));
}

export function migratePluginSettings(raw: LegacyPluginSettings): PluginSettings {
  const settings: PluginSettings = {
    accessToken: raw.accessToken ?? null,
    githubUsername: raw.githubUsername ?? null,
    publishedSites: Array.isArray(raw.publishedSites) ? raw.publishedSites : [],
    savedSetup: raw.savedSetup ?? null,
    templateEngine: raw.templateEngine ?? 'quartz',
    quartzCommitSha: raw.quartzCommitSha ?? null,
  };

  if (settings.publishedSites.length > 0) {
    return settings;
  }

  if (raw.owner && raw.repo && raw.lastPublishedCommitSha && raw.contentFolder) {
    settings.publishedSites = [
      {
        id: siteId(raw.owner, raw.repo),
        owner: raw.owner,
        repo: raw.repo,
        siteName: raw.siteName ?? raw.repo,
        contentFolder: raw.contentFolder,
        lastPublishedCommitSha: raw.lastPublishedCommitSha,
        manifest: raw.manifest ?? {},
        templateEngine: raw.templateEngine ?? 'quartz',
        quartzCommitSha: raw.quartzCommitSha ?? null,
      },
    ];
  }

  return settings;
}
