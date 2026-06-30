import type { ReactElement } from '../react';
import { Outlet } from '../router';
import { FileTree } from './FileTree';
import type { SiteData } from '../types';
import { h } from '../ui';

interface LayoutProps {
  siteData: SiteData;
}

export function Layout({ siteData }: LayoutProps): ReactElement {
  return h(
    'div',
    { className: 'layout' },
    h(
      'aside',
      { className: 'sidebar' },
      h(
        'header',
        { className: 'sidebar-header' },
        h('h1', { className: 'site-title' }, siteData.siteName),
      ),
      h('nav', { className: 'file-tree-nav' }, h(FileTree, { tree: siteData.tree })),
    ),
    h('main', { className: 'main-content' }, h(Outlet, null)),
  );
}
