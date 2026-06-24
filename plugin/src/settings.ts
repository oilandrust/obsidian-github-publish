export interface PluginSettings {
  clientId: string;
  accessToken: string | null;
  githubUsername: string | null;
  owner: string | null;
  repo: string | null;
  siteName: string | null;
  contentFolder: string | null;
  lastPublishedCommitSha: string | null;
  manifest: Record<string, string>;
  savedSetup: SetupConfig | null;
}

export const DEFAULT_SETTINGS: PluginSettings = {
  clientId: '',
  accessToken: null,
  githubUsername: null,
  owner: null,
  repo: null,
  siteName: null,
  contentFolder: null,
  lastPublishedCommitSha: null,
  manifest: {},
  savedSetup: null,
};

export interface SetupConfig {
  siteName: string;
  contentFolder: string;
  repoMode: 'create' | 'existing';
  repoName: string;
}

export interface RepoFile {
  path: string;
  content: Uint8Array;
  encoding: 'utf-8' | 'base64';
}

export type ProgressPhase =
  | 'preparing'
  | 'creating-repo'
  | 'configuring-pages'
  | 'uploading'
  | 'waiting-build'
  | 'waiting-deploy'
  | 'done'
  | 'error';

export interface ProgressState {
  phase: ProgressPhase;
  message: string;
  uploadCurrent?: number;
  uploadTotal?: number;
  liveUrl?: string;
  actionsUrl?: string;
  error?: string;
}
