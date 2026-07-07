export interface PublishedSite {
  id: string;
  owner: string;
  repo: string;
  siteName: string;
  contentFolder: string;
  lastPublishedCommitSha: string;
  manifest: Record<string, string>;
  /** Legacy field; new sites always use Quartz. */
  templateEngine?: 'quartz' | 'inhouse';
  quartzCommitSha: string | null;
  /** Hash of the quartz.config.yaml last published for this site. */
  configHash?: string;
}

export interface PluginSettings {
  accessToken: string | null;
  githubUsername: string | null;
  publishedSites: PublishedSite[];
  savedSetup: SetupConfig | null;
  quartzCommitSha: string | null;
}

export const DEFAULT_SETTINGS: PluginSettings = {
  accessToken: null,
  githubUsername: null,
  publishedSites: [],
  savedSetup: null,
  quartzCommitSha: null,
};

export interface SetupConfig {
  siteName: string;
  contentFolder: string;
  repoMode: 'create' | 'existing';
  repoName: string;
  quartzCommitSha?: string | null;
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
