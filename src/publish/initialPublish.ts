import { App } from 'obsidian';
import { enableGitHubPages } from '../github/pages';
import { createInitialCommit, ensureRepositoryReadyForGit } from '../github/git';
import { resolveRepository } from '../github/repos';
import { ProgressState, RepoFile, SetupConfig } from '../settings';
import {
  loadPublishToolchainFiles,
  publishBundleContextFromConfig,
  assertPublishToolchainReady,
  QUARTZ_CONFIG_FILE,
} from './bundleToolchain';
import { buildContentManifest, hashFileContent } from './diffVault';
import { ensureQuartzHomePage } from './ensureQuartzHomePage';
import { scanVaultFolder } from './scanVault';
import { log } from '../log';

export interface PublishResult {
  owner: string;
  repo: string;
  commitSha: string;
  manifest: Record<string, string>;
  liveUrl: string;
  /** Hash of the quartz.config.yaml published in this run. */
  configHash?: string;
}

export async function runInitialPublish(
  app: App,
  token: string,
  username: string,
  config: SetupConfig,
  onProgress: (state: Partial<ProgressState>) => void,
): Promise<PublishResult> {
  log('Starting initial publish via Git API + GraphQL updateRef', {
    contentFolder: config.contentFolder,
    repo: config.repoName,
  });
  onProgress({ phase: 'preparing', message: 'Scanning vault folder…' });

  let { files: contentFiles, warnings } = await scanVaultFolder(app.vault, config.contentFolder);
  if (contentFiles.length === 0) {
    throw new Error('No publishable files found in the selected folder.');
  }

  contentFiles = ensureQuartzHomePage(contentFiles, config.siteName);

  onProgress({ phase: 'preparing', message: 'Loading publish toolchain…' });
  assertPublishToolchainReady();

  onProgress({
    phase: 'creating-repo',
    message: config.repoMode === 'create' ? 'Creating repository…' : 'Verifying repository…',
  });

  let owner = username;
  let repoName = config.repoName;

  const resolved = await resolveRepository(token, username, config.repoName, config.repoMode);
  owner = resolved.owner;
  repoName = resolved.repoName;
  if (!resolved.created && config.repoMode === 'create') {
    log(`Repository ${owner}/${repoName} already exists — continuing publish`);
  }

  const bundleContext = publishBundleContextFromConfig(config, owner);
  const toolchainFiles = loadPublishToolchainFiles(bundleContext);
  const allFiles: RepoFile[] = sortUploadFiles([...toolchainFiles, ...contentFiles]);
  log(`Prepared ${contentFiles.length} content files and ${toolchainFiles.length} toolchain files`, {
    fileCount: allFiles.length,
    quartzCommitSha: bundleContext.quartzCommitSha,
  });

  onProgress({ phase: 'uploading', message: 'Preparing repository for Git upload…' });
  await ensureRepositoryReadyForGit(token, owner, repoName, (message) => {
    onProgress({ phase: 'uploading', message });
  });

  onProgress({ phase: 'configuring-pages', message: 'Configuring GitHub Pages…' });
  await enableGitHubPages(token, owner, repoName);

  onProgress({
    phase: 'uploading',
    message: 'Creating single Git commit…',
    uploadCurrent: 0,
    uploadTotal: allFiles.length,
  });

  const commitSha = await createInitialCommit(
    token,
    owner,
    repoName,
    allFiles,
    'Initial publish from Obsidian',
    (current, total) => {
      onProgress({
        phase: 'uploading',
        message: `Creating Git commit (${current}/${total})…`,
        uploadCurrent: current,
        uploadTotal: total,
      });
    },
  );

  const manifest = buildContentManifest(allFiles);
  const configFile = toolchainFiles.find((file) => file.path === QUARTZ_CONFIG_FILE);
  const configHash = configFile ? hashFileContent(configFile.content) : undefined;

  if (warnings.length > 0) {
    console.warn('GitHub Publish warnings:', warnings);
  }

  return {
    owner,
    repo: repoName,
    commitSha,
    manifest,
    liveUrl: `https://${owner}.github.io/${repoName}/`,
    configHash,
  };
}

function sortUploadFiles(files: RepoFile[]): RepoFile[] {
  return [...files].sort((a, b) => a.path.localeCompare(b.path));
}
