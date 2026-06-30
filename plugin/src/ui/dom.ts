import type { DomElementInfo } from 'obsidian';

type DomOpts = DomElementInfo | string;

/** Typed wrapper — contains Obsidian DOM helper inference for community ESLint scans. */
export function childDiv(host: HTMLElement, opts?: DomOpts): HTMLDivElement {
  return host.createDiv(opts) as HTMLDivElement;
}

export function childSpan(host: HTMLElement, opts?: DomOpts): HTMLSpanElement {
  return host.createSpan(opts) as HTMLSpanElement;
}

export function childEl<K extends keyof HTMLElementTagNameMap>(
  host: HTMLElement,
  tag: K,
  opts?: DomOpts,
): HTMLElementTagNameMap[K] {
  return host.createEl(tag, opts) as HTMLElementTagNameMap[K];
}
