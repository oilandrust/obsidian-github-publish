import { resolveQuartzCommitSha } from '../quartz/versions';
import { RepoFile, SetupConfig } from '../settings';
import { extname } from '../utils/path';
import {
  assertQuartzToolchainAvailable,
  loadToolchainManifest,
  readToolchainBytes,
  readToolchainText,
} from '../toolchain/embeddedToolchain';

export interface PublishBundleContext {
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
  return TEXT_EXTENSIONS.has(extname(relativePath));
}

function readRepoFile(pluginDir: string, relativePath: string): RepoFile {
  const content = readToolchainBytes(pluginDir, relativePath);
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

function loadQuartzToolchain(pluginDir: string, context: PublishBundleContext): RepoFile[] {
  const filePaths = loadToolchainManifest(pluginDir);
  const files: RepoFile[] = [];

  for (const relativePath of filePaths) {
    if (relativePath.endsWith('.template')) {
      const raw = readToolchainText(pluginDir, relativePath);
      pushTemplatedFile(files, relativePath, raw, context);
      continue;
    }

    const file = readRepoFile(pluginDir, relativePath);
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

export function assertPublishToolchainReady(pluginDir: string): void {
  assertQuartzToolchainAvailable(pluginDir);
}

export function loadPublishToolchainFiles(
  pluginDir: string,
  context: PublishBundleContext,
): RepoFile[] {
  return loadQuartzToolchain(pluginDir, context);
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
