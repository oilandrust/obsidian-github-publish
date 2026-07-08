import { realpathSync } from 'fs';
import type { App } from 'obsidian';
import { FileSystemAdapter, Platform } from 'obsidian';
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

export function absoluteSiteConfigPath(app: App, siteId: string): string | null {
  const adapter = app.vault.adapter;
  if (!(adapter instanceof FileSystemAdapter)) {
    return null;
  }
  return adapter.getFullPath(siteConfigPath(app, siteId));
}

/** Write config to disk so an external editor or Finder reveal can use it. */
export async function ensureSiteConfigOnDisk(
  app: App,
  siteId: string,
  content: string,
): Promise<string> {
  await writeSiteConfigOverride(app, siteId, content);
  const absolute = absoluteSiteConfigPath(app, siteId);
  if (!absolute) {
    throw new Error('Reveal in Finder requires a local vault on disk.');
  }
  return absolute;
}

export function revealPathInFileManager(absolutePath: string): void {
  if (!Platform.isDesktopApp) {
    throw new Error('Reveal in file manager is only available in the desktop app.');
  }
  let resolvedPath = absolutePath;
  try {
    resolvedPath = realpathSync(absolutePath);
  } catch {
    // Fall back to the vault-resolved path if realpath fails.
  }
  const electron = require('electron') as {
    shell: { showItemInFolder: (fullPath: string) => void };
  };
  electron.shell.showItemInFolder(resolvedPath);
}

export function revealInFileManagerLabel(): string {
  if (Platform.isMacOS) {
    return 'Show in Finder';
  }
  if (Platform.isWin) {
    return 'Show in Explorer';
  }
  return 'Show in file manager';
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
