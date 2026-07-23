import { App } from 'obsidian';
import { createContentUpdateCommit } from '../github/git';
import { PublishedSite, ProgressState, RepoFile } from '../settings';
import {
  countDiffChanges,
  diffAgainstManifest,
  formatDiffSummary,
  mergeManifestAfterPublish,
  PublishDiff,
} from './diffVault';
import { PublishResult } from './initialPublish';
import {
  assertPublishToolchainReady,
  getToolchainSync,
  publishBundleContextFromSite,
  QUARTZ_CONFIG_FILE,
} from './bundleToolchain';
import { getSiteConfigChange } from './siteConfig';
import { scanVaultFolder } from './scanVault';
import { log } from '../log';

export async function runPublishChanges(
  app: App,
  token: string,
  site: PublishedSite,
  onProgress: (state: Partial<ProgressState>) => void,
): Promise<PublishResult> {
  const { owner, repo, contentFolder } = site;

  if (!owner || !repo || !contentFolder) {
    throw new Error('Published site configuration is incomplete.');
  }

  log('Starting incremental publish', { owner, repo, contentFolder });

  onProgress({ phase: 'preparing', message: 'Scanning vault for changes…' });
  assertPublishToolchainReady();
  const { files: contentFiles, warnings } = await scanVaultFolder(app.vault, contentFolder);
  const diff = diffAgainstManifest(site.manifest, contentFiles);
  const configChange = await getSiteConfigChange(app, site);
  const toolchainSync = getToolchainSync(site, publishBundleContextFromSite(site));

  if (countDiffChanges(diff) === 0 && !configChange && !toolchainSync) {
    throw new Error('No unpublished changes found.');
  }

  const changedFiles = [...diff.adds, ...diff.updates];
  const uploadFiles: RepoFile[] = [...changedFiles];
  if (configChange) {
    uploadFiles.push({
      path: QUARTZ_CONFIG_FILE,
      content: new TextEncoder().encode(configChange.content),
      encoding: 'utf-8',
    });
  }
  if (toolchainSync) {
    uploadFiles.push(...toolchainSync.files);
  }

  const summary = combineChangeSummary(diff, Boolean(configChange), Boolean(toolchainSync));
  log(`Publishing changes: ${summary}`);

  onProgress({
    phase: 'uploading',
    message: `Uploading ${uploadFiles.length} changed file(s)…`,
    uploadCurrent: 0,
    uploadTotal: uploadFiles.length + 1,
  });

  const commitMessage = buildCommitMessage(diff, Boolean(configChange), Boolean(toolchainSync));

  const commitSha = await createContentUpdateCommit(
    token,
    owner,
    repo,
    uploadFiles,
    diff.deletes,
    commitMessage,
    (current, total) => {
      onProgress({
        phase: 'uploading',
        message:
          current <= uploadFiles.length
            ? `Uploading changed files (${current}/${uploadFiles.length})…`
            : 'Creating Git commit…',
        uploadCurrent: current,
        uploadTotal: total,
      });
    },
  );

  const manifest = mergeManifestAfterPublish(site.manifest, diff);

  if (warnings.length > 0) {
    console.warn('GitHub Publish warnings:', warnings);
  }

  return {
    owner,
    repo,
    commitSha,
    manifest,
    liveUrl: `https://${owner}.github.io/${repo}/`,
    configHash: configChange ? configChange.hash : site.configHash,
    toolchainHash: toolchainSync ? toolchainSync.hash : site.toolchainHash,
  };
}

function combineChangeSummary(
  diff: PublishDiff,
  configChanged: boolean,
  toolchainChanged: boolean,
): string {
  const contentChanges = countDiffChanges(diff);
  if (!configChanged && !toolchainChanged) {
    return formatDiffSummary(diff);
  }

  const parts: string[] = [];
  if (contentChanges > 0) {
    parts.push(formatDiffSummary(diff));
  }
  if (configChanged) {
    parts.push(contentChanges === 0 && !toolchainChanged ? 'Quartz config changed' : 'config changed');
  }
  if (toolchainChanged) {
    parts.push(
      contentChanges === 0 && !configChanged ? 'Toolchain updated' : 'toolchain updated',
    );
  }
  return parts.join(', ');
}

function buildCommitMessage(
  diff: PublishDiff,
  configChanged: boolean,
  toolchainChanged: boolean,
): string {
  const changeCount = countDiffChanges(diff);
  if (changeCount === 0 && configChanged && !toolchainChanged) {
    return 'Update Quartz configuration';
  }
  if (changeCount === 0 && toolchainChanged && !configChanged) {
    return 'Update publish toolchain';
  }
  if (changeCount === 0 && configChanged && toolchainChanged) {
    return 'Update Quartz configuration and publish toolchain';
  }

  const base =
    changeCount === 1 ? 'Publish vault updates' : `Publish vault updates (${changeCount} files)`;
  const extras: string[] = [];
  if (configChanged) extras.push('Quartz config');
  if (toolchainChanged) extras.push('toolchain');
  return extras.length > 0 ? `${base} + ${extras.join(' + ')}` : base;
}

export interface UnpublishedChanges {
  diff: PublishDiff;
  summary: string;
  configChanged: boolean;
  toolchainChanged: boolean;
}

export async function detectUnpublishedChanges(
  app: App,
  site: PublishedSite,
): Promise<UnpublishedChanges | null> {
  if (!site.contentFolder) return null;

  const { files } = await scanVaultFolder(app.vault, site.contentFolder);
  const diff = diffAgainstManifest(site.manifest, files);
  const configChanged = (await getSiteConfigChange(app, site)) !== null;
  const toolchainChanged = getToolchainSync(site) !== null;
  return {
    diff,
    summary: combineChangeSummary(diff, configChanged, toolchainChanged),
    configChanged,
    toolchainChanged,
  };
}
