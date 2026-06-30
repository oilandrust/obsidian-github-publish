import { fetchUrl } from '../utils/request';
import { githubRequest, GitHubApiError } from './client';
import { log } from '../log';

export type ReachabilityStatus = 'checking' | 'live' | 'unreachable' | 'error';

export interface StatusCheck {
  status: ReachabilityStatus;
  detail: string;
  httpStatus?: number;
}

export interface PublishStatusResult {
  repository: StatusCheck;
  liveSite: StatusCheck;
}

export async function checkPublishStatus(
  token: string | null,
  owner: string,
  repo: string,
  liveUrl: string,
): Promise<PublishStatusResult> {
  const [repository, liveSite] = await Promise.all([
    checkRepository(token, owner, repo),
    checkLiveSite(liveUrl),
  ]);
  return { repository, liveSite };
}

async function checkRepository(
  token: string | null,
  owner: string,
  repo: string,
): Promise<StatusCheck> {
  try {
    if (token) {
      await githubRequest(token, 'GET', `/repos/${owner}/${repo}`);
      return { status: 'live', detail: 'Repository reachable' };
    }

    const response = await fetchUrl({
      url: `https://api.github.com/repos/${owner}/${repo}`,
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'GitHub-Publish-Obsidian-Plugin',
      },
      throw: false,
    });

    if (response.status === 200) {
      return { status: 'live', detail: 'Repository reachable', httpStatus: response.status };
    }
    if (response.status === 404) {
      return { status: 'unreachable', detail: 'Repository not found', httpStatus: response.status };
    }
    return {
      status: 'error',
      detail: `Unexpected response (${response.status})`,
      httpStatus: response.status,
    };
  } catch (error: unknown) {
    if (error instanceof GitHubApiError && error.status === 404) {
      return { status: 'unreachable', detail: 'Repository not found', httpStatus: 404 };
    }
    log('Repository status check failed', error);
    return {
      status: 'error',
      detail: error instanceof Error ? error.message : 'Repository check failed',
    };
  }
}

async function checkLiveSite(liveUrl: string): Promise<StatusCheck> {
  try {
    const response = await fetchUrl({
      url: liveUrl,
      method: 'GET',
      throw: false,
    });

    if (response.status >= 200 && response.status < 400) {
      return { status: 'live', detail: 'Site is live', httpStatus: response.status };
    }
    if (response.status === 404) {
      return {
        status: 'unreachable',
        detail: 'Site not found (Pages may still be deploying)',
        httpStatus: response.status,
      };
    }
    return {
      status: 'error',
      detail: `HTTP ${response.status}`,
      httpStatus: response.status,
    };
  } catch (error: unknown) {
    log('Live site status check failed', error);
    return {
      status: 'error',
      detail: error instanceof Error ? error.message : 'Site check failed',
    };
  }
}
