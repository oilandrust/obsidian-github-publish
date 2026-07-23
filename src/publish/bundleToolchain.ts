import { resolveQuartzCommitSha } from '../quartz/versions';
import { PublishedSite, RepoFile, SetupConfig } from '../settings';
import { extname } from '../utils/path';
import {
  assertQuartzToolchainAvailable,
  loadToolchainManifest,
  readToolchainBytes,
  readToolchainText,
} from '../toolchain/embeddedToolchain';
import { TELEMETRY_INGEST_URL } from '../telemetry/ingest';
import { hashFileContent } from './diffVault';

/** Toolchain file users may override per site (Phase 1 customization). */
export const QUARTZ_CONFIG_FILE = 'quartz.config.yaml';

export interface PublishBundleContext {
  siteName: string;
  repoName: string;
  owner: string;
  quartzCommitSha?: string | null;
}

/** Per-site overrides for toolchain files, keyed by their repo-relative path. */
export type ToolchainOverrides = Partial<Record<string, string>>;

const TEXT_EXTENSIONS = new Set([
  '.md',
  '.mjs',
  '.ts',
  '.tsx',
  '.json',
  '.yml',
  '.yaml',
  '.html',
  '.css',
  '.gitignore',
]);

function isTextFile(relativePath: string): boolean {
  if (relativePath.endsWith('.template')) {
    return true;
  }
  return TEXT_EXTENSIONS.has(extname(relativePath));
}

function readRepoFile(relativePath: string): RepoFile {
  const content = readToolchainBytes(relativePath);
  return {
    path: relativePath,
    content,
    encoding: isTextFile(relativePath) ? 'utf-8' : 'base64',
  };
}

function applyTemplate(content: string, context: PublishBundleContext): string {
  const quartzCommitSha = resolveQuartzCommitSha(context.quartzCommitSha);
  const baseUrl = `${context.owner}.github.io/${context.repoName}`;

  return content
    .replaceAll('{{siteName}}', context.siteName)
    .replaceAll('{{repo}}', context.repoName)
    .replaceAll('{{owner}}', context.owner)
    .replaceAll('{{pageTitle}}', context.siteName)
    .replaceAll('{{baseUrl}}', baseUrl)
    .replaceAll('{{quartzCommitSha}}', quartzCommitSha)
    .replaceAll('{{telemetryUrl}}', TELEMETRY_INGEST_URL);
}

function pushTemplatedFile(
  files: RepoFile[],
  relativePath: string,
  rawContent: string,
  context: PublishBundleContext,
): void {
  const outputPath = relativePath.endsWith('.template')
    ? relativePath.slice(0, -'.template'.length)
    : relativePath;

  files.push({
    path: outputPath,
    content: new TextEncoder().encode(applyTemplate(rawContent, context)),
    encoding: 'utf-8',
  });
}

function loadQuartzToolchain(
  context: PublishBundleContext,
  overrides?: ToolchainOverrides,
): RepoFile[] {
  const filePaths = loadToolchainManifest();
  const files: RepoFile[] = [];

  for (const relativePath of filePaths) {
    const override = overrides?.[relativePath];
    if (override !== undefined) {
      // User override is already resolved (no templating placeholders).
      files.push({
        path: relativePath,
        content: new TextEncoder().encode(override),
        encoding: 'utf-8',
      });
      continue;
    }

    if (relativePath.endsWith('.template')) {
      const raw = readToolchainText(relativePath);
      pushTemplatedFile(files, relativePath, raw, context);
      continue;
    }

    const file = readRepoFile(relativePath);
    if (file.encoding === 'utf-8') {
      const templated = applyTemplate(new TextDecoder().decode(file.content), context);
      files.push({
        path: file.path,
        content: new TextEncoder().encode(templated),
        encoding: 'utf-8',
      });
    } else {
      files.push(file);
    }
  }

  return files;
}

export function assertPublishToolchainReady(): void {
  assertQuartzToolchainAvailable();
}

export function loadPublishToolchainFiles(
  context: PublishBundleContext,
  overrides?: ToolchainOverrides,
): RepoFile[] {
  return loadQuartzToolchain(context, overrides);
}

/**
 * Plugin-managed toolchain files that are always synced on publish when the
 * embedded hash drifts. Excludes user-editable quartz.config.yaml.
 */
export function loadManagedToolchainFiles(context: PublishBundleContext): RepoFile[] {
  return loadPublishToolchainFiles(context).filter((file) => file.path !== QUARTZ_CONFIG_FILE);
}

/** Stable hash of managed toolchain file contents (path-ordered). */
export function hashManagedToolchain(files: RepoFile[]): string {
  const parts = [...files]
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((file) => `${file.path}:${hashFileContent(file.content)}`);
  return hashFileContent(new TextEncoder().encode(parts.join('\n')));
}

export interface ToolchainSync {
  files: RepoFile[];
  hash: string;
}

/**
 * Returns managed toolchain files to upload when the site's stored hash does
 * not match the embedded toolchain (always-sync). Legacy sites without a hash
 * always sync once.
 */
export function getToolchainSync(
  site: PublishedSite,
  context: PublishBundleContext = publishBundleContextFromSite(site),
): ToolchainSync | null {
  const files = loadManagedToolchainFiles(context);
  const hash = hashManagedToolchain(files);
  if (site.toolchainHash === hash) {
    return null;
  }
  return { files, hash };
}

/** Embedded quartz.config.yaml with placeholders resolved for a specific site. */
export function resolveDefaultQuartzConfig(context: PublishBundleContext): string {
  return applyTemplate(readToolchainText(QUARTZ_CONFIG_FILE), context);
}

export function publishBundleContextFromConfig(
  config: SetupConfig,
  owner: string,
): PublishBundleContext {
  return {
    siteName: config.siteName,
    repoName: config.repoName,
    owner,
    quartzCommitSha: config.quartzCommitSha,
  };
}

export function publishBundleContextFromSite(site: PublishedSite): PublishBundleContext {
  return {
    siteName: site.siteName,
    repoName: site.repo,
    owner: site.owner,
    quartzCommitSha: site.quartzCommitSha,
  };
}
