import { Notice } from 'obsidian';
import { GitHubPublishHost } from '../pluginHost';
import { GitHubUser } from './client';
import { pollAccessToken, requestDeviceCode } from './auth';
import { GITHUB_OAUTH_CLIENT_ID } from './oauthConfig';

export async function connectGitHub(
  plugin: GitHubPublishHost,
  callbacks?: {
    onUserCode?: (userCode: string, verificationUri: string) => void;
    onPending?: () => void;
  },
): Promise<GitHubUser> {
  const device = await requestDeviceCode(GITHUB_OAUTH_CLIENT_ID);
  callbacks?.onUserCode?.(device.user_code, device.verification_uri);
  window.open(device.verification_uri, '_blank');

  const token = await pollAccessToken(
    GITHUB_OAUTH_CLIENT_ID,
    device.device_code,
    device.interval,
    () => {
      callbacks?.onPending?.();
      new Notice('Waiting for GitHub authorization…');
    },
  );

  return plugin.setAccessToken(token);
}
