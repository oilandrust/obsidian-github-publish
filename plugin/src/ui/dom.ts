import { Notice } from 'obsidian';
import type { DomElementInfo } from 'obsidian';

type DomOpts = DomElementInfo | string;

const COPY_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';

function asElement<T extends HTMLElement>(value: unknown): T {
  return value as T;
}

/** Typed wrapper — contains Obsidian DOM helper inference for community ESLint scans. */
export function childDiv(host: HTMLElement, opts?: DomOpts): HTMLDivElement {
  const el: unknown = host.createDiv(opts);
  return asElement<HTMLDivElement>(el);
}

export function childSpan(host: HTMLElement, opts?: DomOpts): HTMLSpanElement {
  const el: unknown = host.createSpan(opts);
  return asElement<HTMLSpanElement>(el);
}

export function childEl<K extends keyof HTMLElementTagNameMap>(
  host: HTMLElement,
  tag: K,
  opts?: DomOpts,
): HTMLElementTagNameMap[K] {
  const el: unknown = host.createEl(tag, opts);
  return asElement<HTMLElementTagNameMap[K]>(el);
}

export function addCopyButton(
  host: HTMLElement,
  text: string,
  options?: { ariaLabel?: string; successNotice?: string },
): HTMLButtonElement {
  const copyBtn = childEl(host, 'button', {
    cls: 'clickable-icon github-publish-copy-url',
  });
  copyBtn.setAttr('aria-label', options?.ariaLabel ?? 'Copy to clipboard');
  copyBtn.innerHTML = COPY_ICON_SVG;
  copyBtn.addEventListener('click', () => {
    void navigator.clipboard.writeText(text).then(
      () => new Notice(options?.successNotice ?? 'Copied to clipboard'),
      () => new Notice('Could not copy to clipboard'),
    );
  });
  return copyBtn;
}
