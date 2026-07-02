import { githubFormRequest, githubRequest, GitHubUser, sleep } from './client';

const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';

/** Classic OAuth scopes for device flow (space-separated). */
export const OAUTH_SCOPES = 'repo workflow';

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface AccessTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

export async function requestDeviceCode(clientId: string): Promise<DeviceCodeResponse> {
  return githubFormRequest<DeviceCodeResponse>(DEVICE_CODE_URL, {
    client_id: clientId,
    scope: OAUTH_SCOPES,
  });
}

export async function pollAccessToken(
  clientId: string,
  deviceCode: string,
  intervalSeconds: number,
  onPending?: () => void,
): Promise<string> {
  const maxAttempts = 120;
  let attempts = 0;

  while (attempts < maxAttempts) {
    await sleep(intervalSeconds * 1000);
    attempts++;

    const result = await githubFormRequest<AccessTokenResponse>(ACCESS_TOKEN_URL, {
      client_id: clientId,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    });

    if (result.access_token) {
      return result.access_token;
    }

    if (result.error === 'authorization_pending') {
      onPending?.();
      continue;
    }

    if (result.error === 'slow_down') {
      intervalSeconds += 5;
      onPending?.();
      continue;
    }

    throw new Error(result.error_description ?? result.error ?? 'Device flow failed');
  }

  throw new Error('GitHub authorization timed out. Please try again.');
}

export async function fetchGitHubUser(token: string): Promise<GitHubUser> {
  return githubRequest<GitHubUser>(token, 'GET', '/user');
}
