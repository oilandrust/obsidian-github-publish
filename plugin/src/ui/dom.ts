import type { DomElementInfo } from 'obsidian';
import { callBound } from '../utils/call';

type DomOpts = DomElementInfo | string;

function asElement<T extends HTMLElement>(value: unknown): T {
  return value as T;
}

/** Typed wrapper — contains Obsidian DOM helper inference for community ESLint scans. */
export function childDiv(host: HTMLElement, opts?: DomOpts): HTMLDivElement {
  const el: unknown = callBound(host, 'createDiv', opts);
  return asElement<HTMLDivElement>(el);
}

export function childSpan(host: HTMLElement, opts?: DomOpts): HTMLSpanElement {
  const el: unknown = callBound(host, 'createSpan', opts);
  return asElement<HTMLSpanElement>(el);
}

export function childEl<K extends keyof HTMLElementTagNameMap>(
  host: HTMLElement,
  tag: K,
  opts?: DomOpts,
): HTMLElementTagNameMap[K] {
  const el: unknown = callBound(host, 'createEl', tag, opts);
  return asElement<HTMLElementTagNameMap[K]>(el);
}
