import * as path from 'path';
import { resolveQuartzCommitSha } from '../quartz/versions';
import { TemplateEngine } from '../settings';
import { RepoFile, SetupConfig } from '../settings';
import { fileExists, readBytesFile, readTextFile } from '../utils/fs';
import { parseJson } from '../utils/json';
import { ensureEmbeddedAssetsExtracted } from '../toolchain/extractEmbeddedAssets';

interface ToolchainManifest {
  files?: string[];
}

export interface PublishBundleContext {
  templateEngine: TemplateEngine;
  siteName: string;
  repoName: string;
  owner: string;
  quartzCommitSha?: string | null;
}

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
  const ext: string = path.extname(relativePath);
  return TEXT_EXTENSIONS.has(ext);
}

function toolchainDirName(engine: TemplateEngine): string {
  return engine === 'quartz' ? 'toolchain-quartz' : 'toolchain-inhouse';
}

function toolchainMissingMessage(toolchainDir: string, engine: TemplateEngine): string {
  const bundleName = toolchainDirName(engine);
  return (
    `Publish toolchain is missing at ${toolchainDir}.\n\n` +
    `Expected assets/${bundleName}/ in the plugin folder. ` +
    'Try reloading Obsidian or reinstalling the plugin from the community store.\n\n' +
    'Developers: run npm run build in the plugin directory (with assets/ present) or npm run sync:toolchain first.'
  );
}

function loadManifestFiles(toolchainDir: string, engine: TemplateEngine): string[] {
  const manifestPath: string = path.join(toolchainDir, 'manifest.json');
  if (!fileExists(manifestPath)) {
    throw new Error(toolchainMissingMessage(toolchainDir, engine));
  }

  const manifest = parseJson<ToolchainManifest | string[]>(readTextFile(manifestPath));
  return Array.isArray(manifest) ? manifest : manifest.files ?? [];
}

function readRepoFile(toolchainDir: string, relativePath: string): RepoFile {
  const absolute: string = path.join(toolchainDir, relativePath);
  const content: Buffer = readBytesFile(absolute);
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
    .replaceAll('{{quartzCommitSha}}', quartzCommitSha);
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

function loadInhouseToolchain(toolchainDir: string, context: PublishBundleContext): RepoFile[] {
  const filePaths = loadManifestFiles(toolchainDir, context.templateEngine);
  const files: RepoFile[] = [];

  for (const relativePath of filePaths) {
    if (relativePath === 'package.json.template') continue;
    files.push(readRepoFile(toolchainDir, relativePath));
  }

  const packageTemplate = readTextFile(path.join(toolchainDir, 'package.json.template'));
  pushTemplatedFile(files, 'package.json', packageTemplate, context);
  return files;
}

function loadQuartzToolchain(toolchainDir: string, context: PublishBundleContext): RepoFile[] {
  const filePaths = loadManifestFiles(toolchainDir, context.templateEngine);
  const files: RepoFile[] = [];

  for (const relativePath of filePaths) {
    if (relativePath.endsWith('.template')) {
      const raw = readTextFile(path.join(toolchainDir, relativePath));
      pushTemplatedFile(files, relativePath, raw, context);
      continue;
    }

    const file = readRepoFile(toolchainDir, relativePath);
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

export function assertPublishToolchainReady(
  pluginDir: string,
  engine: TemplateEngine,
  pluginVersion: string,
): void {
  ensureEmbeddedAssetsExtracted(pluginDir, pluginVersion);
  const toolchainDir: string = path.join(pluginDir, 'assets', toolchainDirName(engine));
  loadManifestFiles(toolchainDir, engine);
}

export function loadPublishToolchainFiles(
  pluginDir: string,
  context: PublishBundleContext,
): RepoFile[] {
  const engine = context.templateEngine;
  const toolchainDir: string = path.join(pluginDir, 'assets', toolchainDirName(engine));

  if (engine === 'quartz') {
    return loadQuartzToolchain(toolchainDir, context);
  }

  return loadInhouseToolchain(toolchainDir, context);
}

/** @deprecated Use loadPublishToolchainFiles */
export function loadToolchainFiles(
  pluginDir: string,
  siteName: string,
  repoName: string,
): RepoFile[] {
  return loadPublishToolchainFiles(pluginDir, {
    templateEngine: 'inhouse',
    siteName,
    repoName,
    owner: repoName,
  });
}

export function publishBundleContextFromConfig(
  config: SetupConfig,
  owner: string,
): PublishBundleContext {
  return {
    templateEngine: config.templateEngine ?? 'quartz',
    siteName: config.siteName,
    repoName: config.repoName,
    owner,
    quartzCommitSha: config.quartzCommitSha,
  };
}
