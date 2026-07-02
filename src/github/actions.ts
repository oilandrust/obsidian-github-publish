import { githubRequest, sleep } from './client';

export interface WorkflowRun {
  id: number;
  status: string;
  conclusion: string | null;
  html_url: string;
  head_sha: string;
  name: string;
}

interface WorkflowRunsResponse {
  workflow_runs: WorkflowRun[];
}

export function repoActionsUrl(owner: string, repo: string): string {
  return `https://github.com/${owner}/${repo}/actions`;
}

export async function findWorkflowRunForCommit(
  token: string,
  owner: string,
  repo: string,
  commitSha: string,
): Promise<WorkflowRun | null> {
  const response = await githubRequest<WorkflowRunsResponse>(
    token,
    'GET',
    `/repos/${owner}/${repo}/actions/runs?branch=main&event=push&per_page=10`,
  );

  return response.workflow_runs.find((run) => run.head_sha === commitSha) ?? null;
}

export async function getWorkflowRun(
  token: string,
  owner: string,
  repo: string,
  runId: number,
): Promise<WorkflowRun> {
  return githubRequest<WorkflowRun>(token, 'GET', `/repos/${owner}/${repo}/actions/runs/${runId}`);
}

export const ACTIONS_POLL_INTERVAL_MS = 8000;
export const ACTIONS_TIMEOUT_MS = 15 * 60 * 1000;

export async function pollWorkflowRun(
  token: string,
  owner: string,
  repo: string,
  commitSha: string,
  onUpdate: (run: WorkflowRun | null) => void,
  intervalMs = ACTIONS_POLL_INTERVAL_MS,
  maxAttempts = Math.ceil(ACTIONS_TIMEOUT_MS / ACTIONS_POLL_INTERVAL_MS),
): Promise<WorkflowRun> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    const run = await findWorkflowRunForCommit(token, owner, repo, commitSha);
    onUpdate(run);

    if (run && run.status === 'completed') {
      if (run.conclusion !== 'success') {
        throw new Error(`GitHub Actions failed: ${run.html_url}`);
      }
      return run;
    }

    await sleep(intervalMs);
    attempts++;
  }

  throw new Error('Timed out waiting for GitHub Actions to complete (15 minute limit).');
}
