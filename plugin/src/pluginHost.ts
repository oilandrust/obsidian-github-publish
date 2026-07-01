import { App } from 'obsidian';
import { GitHubUser } from './github/client';
import { PluginSettings } from './settings';

/** Plugin surface used by modules that must not import main.ts (avoids circular types). */
export interface GitHubPublishHost {
  app: App;
  settings: PluginSettings;
  saveSettings(): Promise<void>;
  getPluginDir(): string;
  getPluginVersion(): string;
  markSitePublishing(siteId: string): void;
  clearSitePublishing(siteId: string): void;
  isSitePublishing(siteId: string): boolean;
  setAccessToken(token: string): Promise<GitHubUser>;
}
