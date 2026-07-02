import type { Plugin } from 'obsidian';
import type { PluginSettings } from '../settings';

export async function loadPluginSettingsData(plugin: Plugin): Promise<Partial<PluginSettings>> {
  const raw: unknown = await plugin.loadData();
  if (raw === null || typeof raw !== 'object') {
    return {};
  }
  return raw;
}
