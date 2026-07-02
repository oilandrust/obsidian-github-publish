import { log } from '../log';
import { githubRequest, GitHubApiError } from './client';

interface PagesSiteResponse {
  build_type: string;
  status: string | null;
  html_url: string | null;
}

export async function enableGitHubPages(token: string, owner: string, repo: string): Promise<void> {
  const body = { build_type: 'workflow' as const };

  if (await pagesUsesWorkflowBuild(token, owner, repo)) {
    log(`GitHub Pages already uses workflow build for ${owner}/${repo}`);
    return;
  }

  try {
    await githubRequest(token, 'POST', `/repos/${owner}/${repo}/pages`, body);
    log(`Enabled GitHub Pages (workflow) for ${owner}/${repo}`);
    return;
  } catch (error: unknown) {
    if (!(error instanceof GitHubApiError)) throw error;

    // Pages site already exists — switch source to GitHub Actions
    if (error.status === 409 || error.status === 422) {
      await githubRequest(token, 'PUT', `/repos/${owner}/${repo}/pages`, body);
      log(`Updated GitHub Pages (workflow) for ${owner}/${repo}`);
      return;
    }

    throw error;
  }
}

async function pagesUsesWorkflowBuild(
  token: string,
  owner: string,
  repo: string,
): Promise<boolean> {
  try {
    const site = await githubRequest<PagesSiteResponse>(
      token,
      'GET',
      `/repos/${owner}/${repo}/pages`,
    );
    return site.build_type === 'workflow';
  } catch (error: unknown) {
    if (error instanceof GitHubApiError && error.status === 404) {
      return false;
    }
    throw error;
  }
}
