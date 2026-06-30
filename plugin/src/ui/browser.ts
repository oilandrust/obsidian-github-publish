import { callBound, callFn } from '../utils/call';

export function openUrl(url: string): void {
  const openFn: unknown = Reflect.get(globalThis, 'open');
  if (typeof openFn === 'function') {
    callFn(openFn, url, '_blank');
  }
}

export async function copyTextToClipboard(text: string): Promise<void> {
  const navigatorObj: unknown = Reflect.get(globalThis, 'navigator');
  if (navigatorObj === null || typeof navigatorObj !== 'object') {
    throw new Error('Clipboard unavailable');
  }
  const clipboard: unknown = Reflect.get(navigatorObj, 'clipboard');
  if (clipboard === null || typeof clipboard !== 'object') {
    throw new Error('Clipboard unavailable');
  }
  const writeText: unknown = Reflect.get(clipboard, 'writeText');
  if (typeof writeText !== 'function') {
    throw new Error('Clipboard unavailable');
  }
  await callFn(writeText, text);
}
