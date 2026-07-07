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
import { QUARTZ_CONFIG_FILE } from './bundleToolchain';
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
  const { files: contentFiles, warnings } = await scanVaultFolder(app.vault, contentFolder);
  const diff = diffAgainstManifest(site.manifest, contentFiles);
  const configChange = await getSiteConfigChange(app, site);

  if (countDiffChanges(diff) === 0 && !configChange) {
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

  const summary = combineChangeSummary(diff, Boolean(configChange));
  log(`Publishing changes: ${summary}`);

  onProgress({
    phase: 'uploading',
    message: `Uploading ${uploadFiles.length} changed file(s)…`,
    uploadCurrent: 0,
    uploadTotal: uploadFiles.length + 1,
  });

  const commitMessage = buildCommitMessage(diff, Boolean(configChange));

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
  };
}

function combineChangeSummary(diff: PublishDiff, configChanged: boolean): string {
  const contentChanges = countDiffChanges(diff);
  if (!configChanged) {
    return formatDiffSummary(diff);
  }
  if (contentChanges === 0) {
    return 'Quartz config changed';
  }
  return `${formatDiffSummary(diff)}, config changed`;
}

function buildCommitMessage(diff: PublishDiff, configChanged: boolean): string {
  const changeCount = countDiffChanges(diff);
  if (changeCount === 0 && configChanged) {
    return 'Update Quartz configuration';
  }
  const base =
    changeCount === 1 ? 'Publish vault updates' : `Publish vault updates (${changeCount} files)`;
  return configChanged ? `${base} + Quartz config` : base;
}

export interface UnpublishedChanges {
  diff: PublishDiff;
  summary: string;
  configChanged: boolean;
}

export async function detectUnpublishedChanges(
  app: App,
  site: PublishedSite,
): Promise<UnpublishedChanges | null> {
  if (!site.contentFolder) return null;

  const { files } = await scanVaultFolder(app.vault, site.contentFolder);
  const diff = diffAgainstManifest(site.manifest, files);
  const configChanged = (await getSiteConfigChange(app, site)) !== null;
  return { diff, summary: combineChangeSummary(diff, configChanged), configChanged };
}
