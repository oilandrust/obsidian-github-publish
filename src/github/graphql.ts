import { GitHubApiError, githubRequest } from './client';
import { log, logError } from '../log';

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

async function runGraphQLMutation<T>(
  token: string,
  label: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const result = await githubRequest<GraphQLResponse<T>>(
    token,
    'POST',
    'https://api.github.com/graphql',
    { query, variables },
  );

  if (result.errors?.length) {
    logError(`GraphQL ${label} errors`, result.errors);
    const message = result.errors[0].message;
    const hint =
      label === 'updateRef' && message.includes('correct permissions')
        ? ' Reconnect GitHub in settings — publish requires the workflow scope when commits include .github/workflows/.'
        : '';
    throw new GitHubApiError(
      `GitHub GraphQL ${label} failed: ${message}.${hint}`,
      422,
      JSON.stringify(result.errors),
    );
  }

  log(`GraphQL ${label} response`, result);
  return result.data as T;
}

export async function updateBranchRefGraphQL(
  token: string,
  refId: string,
  commitOid: string,
  force = false,
): Promise<void> {
  if (!refId) {
    throw new Error('Ref node_id is missing — cannot update branch via GraphQL.');
  }

  log(`Updating ref ${refId.slice(0, 12)}… via GraphQL to ${commitOid.slice(0, 7)}`);

  const data = await runGraphQLMutation<{
    updateRef: { ref: { name: string; target: { oid: string } | null } | null };
  }>(
    token,
    'updateRef',
    `mutation($input: UpdateRefInput!) {
      updateRef(input: $input) {
        ref {
          name
          target { oid }
        }
      }
    }`,
    {
      input: {
        refId,
        oid: commitOid,
        force,
      },
    },
  );

  const ref = data.updateRef?.ref;
  const oid = ref?.target?.oid;
  if (!ref?.name || !oid) {
    throw new GitHubApiError(
      'GitHub GraphQL updateRef returned no ref — branch was not updated.',
      422,
      JSON.stringify(data),
    );
  }

  if (oid !== commitOid) {
    throw new GitHubApiError(
      `GitHub GraphQL updateRef target mismatch (expected ${commitOid.slice(0, 7)}, got ${oid.slice(0, 7)}).`,
      422,
      JSON.stringify(data),
    );
  }

  log(`GraphQL updated ${ref.name} to ${oid.slice(0, 7)}`);
}

export async function createBranchRefGraphQL(
  token: string,
  repositoryNodeId: string,
  branch: string,
  commitOid: string,
): Promise<void> {
  if (!repositoryNodeId) {
    throw new Error('Repository node_id is missing — cannot create branch via GraphQL.');
  }

  log(`Creating refs/heads/${branch} via GraphQL at ${commitOid.slice(0, 7)}`);

  const data = await runGraphQLMutation<{
    createRef: { ref: { name: string; target: { oid: string } | null } | null };
  }>(
    token,
    'createRef',
    `mutation($input: CreateRefInput!) {
      createRef(input: $input) {
        ref {
          name
          target { oid }
        }
      }
    }`,
    {
      input: {
        name: `refs/heads/${branch}`,
        oid: commitOid,
        repositoryId: repositoryNodeId,
      },
    },
  );

  const ref = data.createRef?.ref;
  const oid = ref?.target?.oid;
  if (!ref?.name || !oid) {
    throw new GitHubApiError(
      'GitHub GraphQL createRef returned no ref — branch was not created.',
      422,
      JSON.stringify(data),
    );
  }

  if (oid !== commitOid) {
    throw new GitHubApiError(
      `GitHub GraphQL createRef target mismatch (expected ${commitOid.slice(0, 7)}, got ${oid.slice(0, 7)}).`,
      422,
      JSON.stringify(data),
    );
  }

  log(`GraphQL created ${ref.name} at ${oid.slice(0, 7)}`);
}
