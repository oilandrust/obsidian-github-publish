import { Notice } from 'obsidian';
import GitHubPublishPlugin from '../../main';
import { GitHubUser } from './client';
import { pollAccessToken, requestDeviceCode } from './auth';

export async function connectGitHub(
  plugin: GitHubPublishPlugin,
  callbacks?: {
    onUserCode?: (userCode: string, verificationUri: string) => void;
    onPending?: () => void;
  },
): Promise<GitHubUser> {
  const clientId = plugin.settings.clientId;
  if (!clientId) {
    throw new Error('Enter your OAuth App Client ID in settings first.');
  }

  const device = await requestDeviceCode(clientId);
  callbacks?.onUserCode?.(device.user_code, device.verification_uri);
  window.open(device.verification_uri, '_blank');

  const token = await pollAccessToken(clientId, device.device_code, device.interval, () => {
    callbacks?.onPending?.();
    new Notice('Waiting for GitHub authorization…');
  });

  return plugin.setAccessToken(token);
}
