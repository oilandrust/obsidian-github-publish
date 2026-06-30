import { Plugin, type Command, type PluginSettingTab } from 'obsidian';
import { callBound } from '../utils/call';

export function pluginAddSettingTab(plugin: Plugin, tab: PluginSettingTab): void {
  callBound(plugin, 'addSettingTab', tab);
}

export function pluginAddCommand(plugin: Plugin, command: Command): void {
  callBound(plugin, 'addCommand', command);
}

export function pluginAddRibbonIcon(
  plugin: Plugin,
  icon: string,
  title: string,
  callback: () => void,
): void {
  callBound(plugin, 'addRibbonIcon', icon, title, callback);
}

export async function savePluginData(plugin: Plugin, data: unknown): Promise<void> {
  await callBound(plugin, 'saveData', data);
}
