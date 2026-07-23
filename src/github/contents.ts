import { GitHubApiError, githubRequest } from './client';
import { log } from '../log';

interface ContentsFileResponse {
  sha: string;
  content?: string;
}

interface ContentsPutResponse {
  commit: { sha: string };
}

/**
 * Upload a file via GitHub Contents API (PUT /repos/.../contents/{path}).
 * Used to seed an empty repository: the Git Data API returns 409 until the
 * repo has at least one commit (GitHub limitation, not a client issue).
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
  } catch (error: unknown) {
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
