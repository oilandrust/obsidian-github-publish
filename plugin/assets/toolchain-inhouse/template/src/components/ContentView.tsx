import type { ComponentType, ReactElement } from 'react';
import type { AssetNode, NoteNode } from '../types';
import { h } from '../ui';

interface ContentViewProps {
  node: NoteNode | AssetNode;
}

function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}assets/${path.split('/').map(encodeURIComponent).join('/')}`;
}

function AssetViewer({ node }: { node: AssetNode }): ReactElement {
  const url = assetUrl(node.path);

  if (node.mime.startsWith('image/')) {
    return h(
      'div',
      { className: 'asset-viewer' },
      h('img', { src: url, alt: node.title, className: 'asset-image' }),
    );
  }

  if (node.mime.startsWith('audio/')) {
    return h(
      'div',
      { className: 'asset-viewer' },
      h('h1', { className: 'asset-title' }, node.title),
      h('audio', { controls: true, src: url, className: 'asset-audio' }),
    );
  }

  if (node.mime === 'application/pdf') {
    return h(
      'div',
      { className: 'asset-viewer asset-viewer-pdf' },
      h('h1', { className: 'asset-title' }, node.title),
      h('iframe', { src: url, title: node.title, className: 'asset-pdf' }),
    );
  }

  return h(
    'div',
    { className: 'asset-viewer' },
    h('h1', { className: 'asset-title' }, node.title),
    h('p', null, h('a', { href: url, download: true }, 'Download file')),
  );
}

const AssetViewerComp = AssetViewer as ComponentType<Record<string, unknown>>;

export function ContentView({ node }: ContentViewProps): ReactElement {
  if (node.type === 'asset') {
    return h(AssetViewerComp, { node });
  }

  return h(
    'article',
    { className: 'note-viewer' },
    h('div', { className: 'prose', dangerouslySetInnerHTML: { __html: node.html } }),
  );
}
