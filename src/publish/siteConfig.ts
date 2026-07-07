import type { App } from 'obsidian';
import { PublishedSite } from '../settings';
import { hashFileContent } from './diffVault';
import {
  publishBundleContextFromSite,
  resolveDefaultQuartzConfig,
} from './bundleToolchain';

const PLUGIN_ID = 'github-publish';
const CONFIG_FILENAME = 'quartz.config.yaml';

function encode(content: string): Uint8Array {
  return new TextEncoder().encode(content);
}

function safeSiteId(siteId: string): string {
  return siteId.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function sitesRoot(app: App): string {
  return `${app.vault.configDir}/plugins/${PLUGIN_ID}/sites`;
}

function siteDir(app: App, siteId: string): string {
  return `${sitesRoot(app)}/${safeSiteId(siteId)}`;
}

export function siteConfigPath(app: App, siteId: string): string {
  return `${siteDir(app, siteId)}/${CONFIG_FILENAME}`;
}

async function ensureDir(app: App, dir: string): Promise<void> {
  if (!(await app.vault.adapter.exists(dir))) {
    await app.vault.adapter.mkdir(dir);
  }
}

export async function hasSiteConfigOverride(app: App, siteId: string): Promise<boolean> {
  return app.vault.adapter.exists(siteConfigPath(app, siteId));
}

export async function readSiteConfigOverride(app: App, siteId: string): Promise<string | null> {
  const path = siteConfigPath(app, siteId);
  if (!(await app.vault.adapter.exists(path))) {
    return null;
  }
  return app.vault.adapter.read(path);
}

export async function writeSiteConfigOverride(
  app: App,
  siteId: string,
  content: string,
): Promise<void> {
  await ensureDir(app, sitesRoot(app));
  await ensureDir(app, siteDir(app, siteId));
  await app.vault.adapter.write(siteConfigPath(app, siteId), content);
}

export async function removeSiteConfigOverride(app: App, siteId: string): Promise<void> {
  const path = siteConfigPath(app, siteId);
  if (await app.vault.adapter.exists(path)) {
    await app.vault.adapter.remove(path);
  }
}

/** Hash of the config currently live for the site (stored baseline, or the embedded default). */
function baselineConfigHash(site: PublishedSite): string {
  if (site.configHash) {
    return site.configHash;
  }
  const defaultConfig = resolveDefaultQuartzConfig(publishBundleContextFromSite(site));
  return hashFileContent(encode(defaultConfig));
}

export interface SiteConfigChange {
  content: string;
  hash: string;
}

/**
 * Returns the override content and hash when the site has an override that differs
 * from what is currently published; otherwise null (no override, or unchanged).
 */
export async function getSiteConfigChange(
  app: App,
  site: PublishedSite,
): Promise<SiteConfigChange | null> {
  const override = await readSiteConfigOverride(app, site.id);
  if (override === null) {
    return null;
  }
  const hash = hashFileContent(encode(override));
  if (hash === baselineConfigHash(site)) {
    return null;
  }
  return { content: override, hash };
}
