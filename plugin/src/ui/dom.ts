import { Notice } from 'obsidian';
import type { DomElementInfo } from 'obsidian';

type DomOpts = DomElementInfo | string;

const SVG_NS = 'http://www.w3.org/2000/svg';

function appendCopyIcon(button: HTMLButtonElement): void {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');

  const rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('width', '14');
  rect.setAttribute('height', '14');
  rect.setAttribute('x', '8');
  rect.setAttribute('y', '8');
  rect.setAttribute('rx', '2');
  rect.setAttribute('ry', '2');
  svg.appendChild(rect);

  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2');
  svg.appendChild(path);

  button.appendChild(svg);
}

function appendTrashIcon(button: HTMLButtonElement): void {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');

  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M3 6h18');
  svg.appendChild(path);

  const path2 = document.createElementNS(SVG_NS, 'path');
  path2.setAttribute(
    'd',
    'M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6',
  );
  svg.appendChild(path2);

  const path3 = document.createElementNS(SVG_NS, 'path');
  path3.setAttribute('d', 'M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2');
  svg.appendChild(path3);

  button.appendChild(svg);
}

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
  appendCopyIcon(copyBtn);
  copyBtn.addEventListener('click', () => {
    void navigator.clipboard.writeText(text).then(
      () => new Notice(options?.successNotice ?? 'Copied to clipboard'),
      () => new Notice('Could not copy to clipboard'),
    );
  });
  return copyBtn;
}

export function addTrashButton(
  host: HTMLElement,
  options: { ariaLabel?: string; onClick: () => void },
): HTMLButtonElement {
  const trashBtn = childEl(host, 'button', {
    cls: 'clickable-icon github-publish-untrack-button',
  });
  trashBtn.setAttr('aria-label', options.ariaLabel ?? 'Stop tracking site');
  appendTrashIcon(trashBtn);
  trashBtn.addEventListener('click', options.onClick);
  return trashBtn;
}
