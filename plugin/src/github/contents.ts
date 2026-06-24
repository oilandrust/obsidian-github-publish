import { GitHubApiError, githubRequest } from './client';
import { log } from '../log';

interface ContentsFileResponse {
  sha: string;
  content?: string;
}

interface ContentsPutResponse {
  commit: { sha: string };
}

interface ContentsDeleteResponse {
  commit: { sha: string };
}

const INIT_PLACEHOLDER_PATH = '.github-publish-init';
const MAX_FILE_BYTES = 100 * 1024 * 1024;

/**
 * Upload many files via Contents API (one commit per file).
 * Reliable in Obsidian; avoids Git Database API and PATCH ref updates.
 */
export async function uploadFilesViaContents(
  token: string,
  owner: string,
  repo: string,
  files: { path: string; content: Uint8Array }[],
  message: string,
  onProgress?: (current: number, total: number) => void,
): Promise<string> {
  if (files.length === 0) {
    throw new Error('No files to upload.');
  }

  let lastCommitSha = '';

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.content.byteLength > MAX_FILE_BYTES) {
      throw new Error(`File too large for GitHub (>100MB): ${file.path}`);
    }

    onProgress?.(i + 1, files.length);
    const commitMessage =
      files.length === 1 ? message : `${message}: ${file.path}`;

    lastCommitSha = await putFileContents(
      token,
      owner,
      repo,
      file.path,
      file.content,
      commitMessage,
    );
  }

  return lastCommitSha;
}

export async function deleteFileContents(
  token: string,
  owner: string,
  repo: string,
  path: string,
  message: string,
): Promise<string | undefined> {
  const sha = await getFileContentsSha(token, owner, repo, path);
  if (!sha) return undefined;

  log(`DELETE contents/${path}`);

  const response = await githubRequest<ContentsDeleteResponse>(
    token,
    'DELETE',
    `/repos/${owner}/${repo}/contents/${encodeRepoPath(path)}`,
    { message, sha },
  );

  return response.commit.sha;
}

export async function removeInitPlaceholder(
  token: string,
  owner: string,
  repo: string,
): Promise<void> {
  const sha = await deleteFileContents(
    token,
    owner,
    repo,
    INIT_PLACEHOLDER_PATH,
    'Remove GitHub Publish init placeholder',
  );
  if (sha) {
    log(`Removed ${INIT_PLACEHOLDER_PATH}`);
  }
}

/**
 * Upload a file via GitHub Contents API (PUT /repos/.../contents/{path}).
 * Works on empty repos and does not need PATCH (which Obsidian's HTTP client mishandles).
 */
export async function putFileContents(
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: Uint8Array,
  message: string,
): Promise<string> {
  const existingSha = await getFileContentsSha(token, owner, repo, path);

  log(
    `PUT contents/${path}${existingSha ? ` (update, sha ${existingSha.slice(0, 7)})` : ' (create)'}`,
  );

  const response = await githubRequest<ContentsPutResponse>(
    token,
    'PUT',
    `/repos/${owner}/${repo}/contents/${encodeRepoPath(path)}`,
    {
      message,
      content: bytesToBase64(content),
      ...(existingSha ? { sha: existingSha } : {}),
    },
  );

  return response.commit.sha;
}

export async function getFileContentsSha(
  token: string,
  owner: string,
  repo: string,
  path: string,
): Promise<string | undefined> {
  try {
    const response = await githubRequest<ContentsFileResponse>(
      token,
      'GET',
      `/repos/${owner}/${repo}/contents/${encodeRepoPath(path)}`,
    );
    return response.sha;
  } catch (error) {
    if (error instanceof GitHubApiError && error.status === 404) {
      return undefined;
    }
    throw error;
  }
}

function encodeRepoPath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
