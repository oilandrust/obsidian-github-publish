import { RepoFile } from '../settings';
import { log, logWarn } from '../log';
import { GitHubApiError, githubRequest, githubRequestWithRetry, isGitRepositoryEmptyError, isMissingBranchRefError, sleep } from './client';
import { createBranchRefGraphQL, updateBranchRefGraphQL } from './graphql';
import { putFileContents } from './contents';
import { getRepo } from './repos';

interface BlobResponse {
  sha: string;
}

interface TreeItem {
  path: string;
  mode: '100644' | '040000';
  type: 'blob' | 'tree';
  sha: string;
}

interface TreeResponse {
  sha: string;
}

interface CommitResponse {
  sha: string;
}

interface BlobEntry {
  path: string;
  sha: string;
}

interface TreeNode {
  files: { name: string; sha: string }[];
  children: Map<string, TreeNode>;
}

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const GIT_RETRY_STATUSES = [409];

export async function ensureRepositoryReadyForGit(
  token: string,
  owner: string,
  repo: string,
  onStatus?: (message: string) => void,
): Promise<void> {
  const repoInfo = await getRepo(token, owner, repo);
  const branch = repoInfo.default_branch || 'main';

  if (await branchExists(token, owner, repo, branch)) {
    log(`Repository ${owner}/${repo} already has branch ${branch}`);
    return;
  }

  const blobPath = `/repos/${owner}/${repo}/git/blobs`;
  log(`Preparing ${owner}/${repo} for Git upload`);

  for (let attempt = 0; attempt < 8; attempt++) {
    onStatus?.(`Checking Git API (attempt ${attempt + 1}/8)…`);
    try {
      await githubRequest(token, 'POST', blobPath, {
        content: 'github-publish-ready-probe',
        encoding: 'utf-8',
      });
      log(`Repository ${owner}/${repo} is ready for Git upload`);
      return;
    } catch (error) {
      if (!(error instanceof GitHubApiError) || error.status !== 409) {
        throw error;
      }

      if (isGitRepositoryEmptyError(error)) {
        onStatus?.('Initializing repository…');
        log(`Repository ${owner}/${repo} is empty — initializing via Contents API`);
        await initializeRepository(token, owner, repo);
        log(`Repository ${owner}/${repo} initialized`);
        return;
      }

      logWarn(`Git API not ready for ${owner}/${repo} (409), attempt ${attempt + 1}/8`);

      if (attempt < 7) {
        const delayMs = Math.min(1000 * 2 ** attempt, 16000);
        onStatus?.(`Waiting for repository (${attempt + 1}/8, retry in ${Math.round(delayMs / 1000)}s)…`);
        await sleep(delayMs);
        continue;
      }

      onStatus?.('Initializing repository…');
      log(`Initializing ${owner}/${repo} via Contents API after repeated 409 responses`);
      await initializeRepository(token, owner, repo);
      log(`Repository ${owner}/${repo} initialized`);
      return;
    }
  }
}

async function initializeRepository(token: string, owner: string, repo: string): Promise<void> {
  try {
    await putFileContents(
      token,
      owner,
      repo,
      '.github-publish-init',
      new Uint8Array(),
      'Initialize repository for GitHub Publish',
    );
  } catch (error) {
    if (error instanceof GitHubApiError && error.status === 422) {
      const repoInfo = await getRepo(token, owner, repo);
      const branch = repoInfo.default_branch || 'main';
      if (await branchExists(token, owner, repo, branch)) {
        log(`Repository ${owner}/${repo} already initialized`);
        return;
      }
    }
    throw error;
  }
}

export async function createInitialCommit(
  token: string,
  owner: string,
  repo: string,
  files: RepoFile[],
  message: string,
  onProgress?: (current: number, total: number) => void,
): Promise<string> {
  for (const file of files) {
    if (file.content.byteLength > MAX_FILE_BYTES) {
      throw new Error(`File too large for GitHub (>100MB): ${file.path}`);
    }
  }

  const treeItems: BlobEntry[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress?.(i + 1, files.length);

    const blob = await githubRequestWithRetry<BlobResponse>(
      token,
      'POST',
      `/repos/${owner}/${repo}/git/blobs`,
      {
        content:
          file.encoding === 'utf-8'
            ? new TextDecoder().decode(file.content)
            : uint8ArrayToBase64(file.content),
        encoding: file.encoding,
      },
      { retryStatuses: GIT_RETRY_STATUSES },
    );

    if (!blob.sha) {
      throw new Error(`GitHub returned an empty blob SHA for ${file.path}`);
    }

    treeItems.push({
      path: normalizeRepoPath(file.path),
      sha: blob.sha,
    });
  }

  log(`Creating Git tree for ${treeItems.length} files in ${owner}/${repo}`);
  const treeSha = await createHierarchicalTree(token, owner, repo, treeItems);

  return createCommitAndUpdateBranch(token, owner, repo, treeSha, message);
}

export async function createContentUpdateCommit(
  token: string,
  owner: string,
  repo: string,
  files: RepoFile[],
  deletes: string[],
  message: string,
  onProgress?: (current: number, total: number) => void,
): Promise<string> {
  if (files.length === 0 && deletes.length === 0) {
    throw new Error('No content changes to publish.');
  }

  for (const file of files) {
    if (file.content.byteLength > MAX_FILE_BYTES) {
      throw new Error(`File too large for GitHub (>100MB): ${file.path}`);
    }
  }

  const totalSteps = files.length + 1;
  let step = 0;

  const attemptCommit = async (): Promise<string> => {
    const repoInfo = await getRepo(token, owner, repo);
    const branch = repoInfo.default_branch || 'main';
    const branchRef = await getBranchRef(token, owner, repo, branch);
    if (!branchRef) {
      throw new Error(`Branch ${branch} does not exist — run initial publish first.`);
    }

    const parentSha = branchRef.object.sha;
    const parentCommit = await githubRequest<{ tree: { sha: string } }>(
      token,
      'GET',
      `/repos/${owner}/${repo}/git/commits/${parentSha}`,
    );
    const baseTreeSha = parentCommit.tree.sha;

    const tree: FlatTreeItem[] = [];

    for (const file of files) {
      step++;
      onProgress?.(step, totalSteps);

      const blob = await githubRequestWithRetry<BlobResponse>(
        token,
        'POST',
        `/repos/${owner}/${repo}/git/blobs`,
        {
          content:
            file.encoding === 'utf-8'
              ? new TextDecoder().decode(file.content)
              : uint8ArrayToBase64(file.content),
          encoding: file.encoding,
        },
        { retryStatuses: GIT_RETRY_STATUSES },
      );

      if (!blob.sha) {
        throw new Error(`GitHub returned an empty blob SHA for ${file.path}`);
      }

      tree.push({
        path: normalizeRepoPath(file.path),
        mode: '100644',
        type: 'blob',
        sha: blob.sha,
      });
    }

    for (const path of deletes) {
      tree.push({
        path: normalizeRepoPath(path),
        mode: '100644',
        type: 'blob',
        sha: null,
      });
    }

    step++;
    onProgress?.(step, totalSteps);

    log(`Creating incremental tree (${tree.length} entries) on ${baseTreeSha.slice(0, 7)}`);
    const newTree = await githubRequestWithRetry<TreeResponse>(
      token,
      'POST',
      `/repos/${owner}/${repo}/git/trees`,
      { base_tree: baseTreeSha, tree },
      { retryStatuses: GIT_RETRY_STATUSES },
    );

    log(`Creating content update commit on ${branch}@${parentSha.slice(0, 7)}`);
    const commit = await githubRequestWithRetry<CommitResponse>(
      token,
      'POST',
      `/repos/${owner}/${repo}/git/commits`,
      {
        message,
        tree: newTree.sha,
        parents: [parentSha],
      },
      { retryStatuses: GIT_RETRY_STATUSES },
    );

    await updateBranchRef(token, repoInfo.node_id, branch, commit.sha, owner, repo);
    return commit.sha;
  };

  try {
    return await attemptCommit();
  } catch (error) {
    if (error instanceof GitHubApiError && error.status === 409) {
      logWarn('Content update commit conflict (409), retrying with fresh parent');
      step = 0;
      return await attemptCommit();
    }
    throw error;
  }
}

interface FlatTreeItem {
  path: string;
  mode: '100644';
  type: 'blob';
  sha: string | null;
}

interface RefResponse {
  ref: string;
  node_id: string;
  url: string;
  object: { sha: string; type: string };
}

async function getBranchRef(
  token: string,
  owner: string,
  repo: string,
  branch: string,
): Promise<RefResponse | null> {
  try {
    return await githubRequest<RefResponse>(
      token,
      'GET',
      `/repos/${owner}/${repo}/git/ref/heads/${branch}`,
    );
  } catch (error) {
    if (isMissingBranchRefError(error)) {
      return null;
    }
    throw error;
  }
}

export async function getBranchHeadSha(
  token: string,
  owner: string,
  repo: string,
  branch?: string,
): Promise<string | null> {
  const repoInfo = await getRepo(token, owner, repo);
  const branchName = branch ?? repoInfo.default_branch ?? 'main';
  const ref = await getBranchRef(token, owner, repo, branchName);
  return ref?.object.sha ?? null;
}

async function createCommitAndUpdateBranch(
  token: string,
  owner: string,
  repo: string,
  treeSha: string,
  message: string,
): Promise<string> {
  const repoInfo = await getRepo(token, owner, repo);
  const branch = repoInfo.default_branch || 'main';
  const branchRef = await getBranchRef(token, owner, repo, branch);

  const commitBody: { message: string; tree: string; parents?: string[] } = {
    message,
    tree: treeSha,
  };

  if (branchRef) {
    commitBody.parents = [branchRef.object.sha];
    log(`Creating commit on top of ${branch}@${branchRef.object.sha.slice(0, 7)}`);
  } else {
    log(`Creating initial commit for ${branch}`);
  }

  const commit = await githubRequestWithRetry<CommitResponse>(
    token,
    'POST',
    `/repos/${owner}/${repo}/git/commits`,
    commitBody,
    { retryStatuses: GIT_RETRY_STATUSES },
  );

  if (branchRef) {
    await updateBranchRef(
      token,
      repoInfo.node_id,
      branch,
      commit.sha,
      owner,
      repo,
    );
    return commit.sha;
  }

  log(`Creating branch ${branch} at ${commit.sha.slice(0, 7)}`);
  try {
    await githubRequestWithRetry(
      token,
      'POST',
      `/repos/${owner}/${repo}/git/refs`,
      { ref: `refs/heads/${branch}`, sha: commit.sha },
      { retryStatuses: GIT_RETRY_STATUSES },
    );
  } catch (error) {
    if (error instanceof GitHubApiError && [404, 409, 422].includes(error.status)) {
      logWarn(`POST ref failed (${error.status}), falling back to branch update`);
      await updateBranchRef(
        token,
        repoInfo.node_id,
        branch,
        commit.sha,
        owner,
        repo,
      );
    } else {
      throw error;
    }
  }

  return commit.sha;
}

async function updateBranchRef(
  token: string,
  repositoryNodeId: string,
  branch: string,
  commitSha: string,
  owner: string,
  repo: string,
): Promise<void> {
  await sleep(500);

  const currentRef = await getBranchRef(token, owner, repo, branch);
  if (currentRef?.node_id) {
    await updateBranchRefGraphQL(token, currentRef.node_id, commitSha);
  } else {
    await createBranchRefGraphQL(token, repositoryNodeId, branch, commitSha);
  }

  // GraphQL mutation response confirms target oid — REST git/ref can lag behind.
  log(`Verified ${branch} now points to ${commitSha.slice(0, 7)} (via GraphQL)`);
}

async function branchExists(
  token: string,
  owner: string,
  repo: string,
  branch: string,
): Promise<boolean> {
  try {
    await githubRequest(token, 'GET', `/repos/${owner}/${repo}/git/ref/heads/${branch}`);
    return true;
  } catch (error) {
    if (isMissingBranchRefError(error)) {
      return false;
    }
    throw error;
  }
}

function normalizeRepoPath(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
  if (!normalized) {
    throw new Error('Encountered an empty repository path while preparing upload.');
  }
  if (normalized.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new Error(`Invalid repository path: ${path}`);
  }
  return normalized;
}

function dedupeBlobEntries(entries: BlobEntry[]): BlobEntry[] {
  const byPath = new Map<string, BlobEntry>();
  for (const entry of entries) {
    byPath.set(entry.path, entry);
  }
  return [...byPath.values()];
}

function buildTreeNode(entries: BlobEntry[]): TreeNode {
  const root: TreeNode = { files: [], children: new Map() };

  for (const entry of entries) {
    const parts = entry.path.split('/');
    let node = root;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      let child = node.children.get(part);
      if (!child) {
        child = { files: [], children: new Map() };
        node.children.set(part, child);
      }
      node = child;
    }

    const fileName = parts[parts.length - 1];
    const existing = node.files.find((file) => file.name === fileName);
    if (existing) {
      logWarn(`Duplicate path in upload set, using latest blob: ${entry.path}`);
      existing.sha = entry.sha;
    } else {
      node.files.push({ name: fileName, sha: entry.sha });
    }
  }

  return root;
}

async function createHierarchicalTree(
  token: string,
  owner: string,
  repo: string,
  entries: BlobEntry[],
): Promise<string> {
  const uniqueEntries = dedupeBlobEntries(entries);
  const root = buildTreeNode(uniqueEntries);
  return createTreeNode(token, owner, repo, root, '(root)');
}

async function createTreeNode(
  token: string,
  owner: string,
  repo: string,
  node: TreeNode,
  label: string,
): Promise<string> {
  const tree: TreeItem[] = [];

  for (const [name, child] of [...node.children.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const childSha = await createTreeNode(token, owner, repo, child, `${label}/${name}`);
    tree.push({
      path: name,
      mode: '040000',
      type: 'tree',
      sha: childSha,
    });
  }

  for (const file of [...node.files].sort((a, b) => a.name.localeCompare(b.name))) {
    tree.push({
      path: file.name,
      mode: '100644',
      type: 'blob',
      sha: file.sha,
    });
  }

  if (tree.length === 0) {
    throw new Error(`No tree entries generated for ${label}`);
  }

  log(`Creating tree for ${label} (${tree.length} entries)`);

  const response = await githubRequestWithRetry<TreeResponse>(
    token,
    'POST',
    `/repos/${owner}/${repo}/git/trees`,
    { tree },
    { retryStatuses: GIT_RETRY_STATUSES },
  );

  return response.sha;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
