import { fetchUrl } from '../utils/request';
import { log, logWarn } from '../log';
import { parseJson } from '../utils/json';

const GITHUB_API = 'https://api.github.com';

export class GitHubApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: string,
  ) {
    super(message);
    this.name = 'GitHubApiError';
  }
}

function formatGitHubError(method: string, apiPath: string, status: number, body?: string): string {
  const detail = parseGitHubErrorMessage(body);
  return detail
    ? `GitHub API ${method} ${apiPath} failed (${status}): ${detail}`
    : `GitHub API ${method} ${apiPath} failed (${status})`;
}

export function isGitRepositoryEmptyError(error: GitHubApiError): boolean {
  if (error.status !== 409) return false;
  if (!error.body) return false;
  try {
    const parsed = parseJson<{ message?: string }>(error.body);
    return parsed.message === 'Git Repository is empty.';
  } catch {
    return error.body.includes('Git Repository is empty');
  }
}

export function isMissingBranchRefError(error: unknown): boolean {
  if (!(error instanceof GitHubApiError)) return false;
  return error.status === 404 || isGitRepositoryEmptyError(error);
}

function parseGitHubErrorMessage(body?: string): string | undefined {
  if (!body) return undefined;
  try {
    const parsed = parseJson<{ message?: string }>(body);
    return parsed.message;
  } catch {
    return body.length > 200 ? `${body.slice(0, 200)}…` : body;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function githubRequest<T>(
  token: string,
  method: string,
  apiPath: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'GitHub-Publish-Obsidian-Plugin',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  log(`${method} ${apiPath}`);

  const response = await fetchUrl({
    url: apiPath.startsWith('http') ? apiPath : `${GITHUB_API}${apiPath}`,
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    contentType: 'application/json',
    throw: false,
  });

  if (response.status >= 400) {
    logWarn(`${method} ${apiPath} → ${response.status}`, response.text);
    throw new GitHubApiError(
      formatGitHubError(method, apiPath, response.status, response.text),
      response.status,
      response.text,
    );
  }

  log(`${method} ${apiPath} → ${response.status}`);

  if (!response.text || response.text.length === 0) {
    return {} as T;
  }

  return parseJson<T>(response.text);
}

export async function githubRequestWithRetry<T>(
  token: string,
  method: string,
  apiPath: string,
  body?: unknown,
  options?: { maxAttempts?: number; retryStatuses?: number[] },
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 8;
  const retryStatuses = options?.retryStatuses ?? [409];

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await githubRequest<T>(token, method, apiPath, body);
    } catch (error: unknown) {
      const shouldRetry =
        error instanceof GitHubApiError &&
        retryStatuses.includes(error.status) &&
        attempt < maxAttempts - 1;

      if (!shouldRetry) throw error;

      const delayMs = Math.min(1000 * 2 ** attempt, 16000);
      logWarn(`Retry ${attempt + 2}/${maxAttempts} in ${delayMs}ms after ${error.status}: ${method} ${apiPath}`);
      await sleep(delayMs);
    }
  }

  throw new Error('GitHub request retry loop exhausted');
}

export async function githubFormRequest<T>(
  url: string,
  fields: Record<string, string>,
): Promise<T> {
  const body = new URLSearchParams(fields).toString();
  const response = await fetchUrl({
    url,
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    throw: false,
  });

  if (response.status >= 400) {
    throw new GitHubApiError(
      `GitHub request failed (${response.status})`,
      response.status,
      response.text,
    );
  }

  return parseJson<T>(response.text);
}

export interface GitHubUser {
  login: string;
  id: number;
}
