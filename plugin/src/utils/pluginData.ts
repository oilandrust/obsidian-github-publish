import type { Plugin } from 'obsidian';
import type { PluginSettings } from '../settings';
import { callBound } from './call';

export async function loadPluginSettingsData(plugin: Plugin): Promise<Partial<PluginSettings>> {
  const raw: unknown = await callBound(plugin, 'loadData');
  if (raw === null || typeof raw !== 'object') {
    return {};
  }
  return raw as Partial<PluginSettings>;
}
