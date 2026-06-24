import { App } from 'obsidian';
import { createContentUpdateCommit } from '../github/git';
import { PluginSettings, ProgressState } from '../settings';
import {
  countDiffChanges,
  diffAgainstManifest,
  formatDiffSummary,
  mergeManifestAfterPublish,
} from './diffVault';
import { PublishResult } from './initialPublish';
import { scanVaultFolder } from './scanVault';
import { log } from '../log';

export async function runPublishChanges(
  app: App,
  token: string,
  settings: PluginSettings,
  onProgress: (state: Partial<ProgressState>) => void,
): Promise<PublishResult> {
  const owner = settings.owner;
  const repo = settings.repo;
  const contentFolder = settings.contentFolder;

  if (!owner || !repo || !contentFolder) {
    throw new Error('Published site configuration is incomplete.');
  }

  log('Starting incremental publish', { owner, repo, contentFolder });

  onProgress({ phase: 'preparing', message: 'Scanning vault for changes…' });
  const { files: contentFiles, warnings } = await scanVaultFolder(app.vault, contentFolder);
  const diff = diffAgainstManifest(settings.manifest, contentFiles);

  if (countDiffChanges(diff) === 0) {
    throw new Error('No unpublished changes found.');
  }

  const changedFiles = [...diff.adds, ...diff.updates];
  const summary = formatDiffSummary(diff);
  log(`Publishing changes: ${summary}`);

  onProgress({
    phase: 'uploading',
    message: `Uploading ${changedFiles.length} changed file(s)…`,
    uploadCurrent: 0,
    uploadTotal: changedFiles.length + 1,
  });

  const changeCount = countDiffChanges(diff);
  const commitMessage =
    changeCount === 1
      ? 'Publish vault updates'
      : `Publish vault updates (${changeCount} files)`;

  const commitSha = await createContentUpdateCommit(
    token,
    owner,
    repo,
    changedFiles,
    diff.deletes,
    commitMessage,
    (current, total) => {
      onProgress({
        phase: 'uploading',
        message:
          current <= changedFiles.length
            ? `Uploading changed files (${current}/${changedFiles.length})…`
            : 'Creating Git commit…',
        uploadCurrent: current,
        uploadTotal: total,
      });
    },
  );

  const manifest = mergeManifestAfterPublish(settings.manifest, diff);

  if (warnings.length > 0) {
    console.warn('GitHub Publish warnings:', warnings);
  }

  return {
    owner,
    repo,
    commitSha,
    manifest,
    liveUrl: `https://${owner}.github.io/${repo}/`,
  };
}

export async function detectUnpublishedChanges(
  app: App,
  settings: PluginSettings,
): Promise<{ diff: ReturnType<typeof diffAgainstManifest>; summary: string } | null> {
  if (!settings.contentFolder) return null;

  const { files } = await scanVaultFolder(app.vault, settings.contentFolder);
  const diff = diffAgainstManifest(settings.manifest, files);
  return { diff, summary: formatDiffSummary(diff) };
}
