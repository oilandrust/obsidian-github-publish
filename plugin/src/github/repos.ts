import { githubRequest, GitHubApiError, isMissingBranchRefError } from './client';
import { log } from '../log';

export interface GitHubRepo {
  id: number;
  node_id: string;
  name: string;
  full_name: string;
  private: boolean;
  owner: { login: string };
  default_branch: string;
  size: number;
}

export async function listUserRepos(token: string): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  let page = 1;

  while (page <= 5) {
    const batch = await githubRequest<GitHubRepo[]>(
      token,
      'GET',
      `/user/repos?per_page=100&page=${page}&sort=updated`,
    );
    if (!batch.length) break;
    repos.push(...batch);
    if (batch.length < 100) break;
    page++;
  }

  return repos;
}

export async function createRepo(
  token: string,
  name: string,
  isPrivate = false,
  autoInit = false,
): Promise<GitHubRepo> {
  return githubRequest<GitHubRepo>(token, 'POST', '/user/repos', {
    name,
    private: isPrivate,
    auto_init: autoInit,
  });
}

export async function resolveRepository(
  token: string,
  username: string,
  repoName: string,
  mode: 'create' | 'existing',
): Promise<{ owner: string; repoName: string; created: boolean }> {
  if (mode === 'existing') {
    const existing = await getRepo(token, username, repoName);
    return {
      owner: existing.owner.login,
      repoName: existing.name,
      created: false,
    };
  }

  try {
    const created = await createRepo(token, repoName, false, false);
    return {
      owner: created.owner.login,
      repoName: created.name,
      created: true,
    };
  } catch (error: unknown) {
    if (error instanceof GitHubApiError && error.status === 422) {
      log(`Repository ${username}/${repoName} already exists — continuing publish`);
      const existing = await getRepo(token, username, repoName);
      return {
        owner: existing.owner.login,
        repoName: existing.name,
        created: false,
      };
    }
    throw error;
  }
}

export async function getRepo(
  token: string,
  owner: string,
  repo: string,
): Promise<GitHubRepo> {
  return githubRequest<GitHubRepo>(token, 'GET', `/repos/${owner}/${repo}`);
}

export async function isRepoEmpty(token: string, owner: string, repo: string): Promise<boolean> {
  try {
    await githubRequest(token, 'GET', `/repos/${owner}/${repo}/git/ref/heads/main`);
    return false;
  } catch (error: unknown) {
    if (isMissingBranchRefError(error)) {
      return true;
    }
    throw error;
  }
}
