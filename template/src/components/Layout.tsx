import type { ComponentType, ReactElement } from 'react';
import { Outlet } from 'react-router-dom';
import { FileTree } from './FileTree';
import type { SiteData } from '../types';
import { h } from '../ui';

interface LayoutProps {
  siteData: SiteData;
}

const MainOutlet = Outlet as ComponentType<Record<string, unknown>>;
const Tree = FileTree as ComponentType<Record<string, unknown>>;

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
      h('nav', { className: 'file-tree-nav' }, h(Tree, { tree: siteData.tree })),
    ),
    h('main', { className: 'main-content' }, h(MainOutlet, null)),
  );
}
