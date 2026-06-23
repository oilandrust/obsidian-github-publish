import { Outlet } from 'react-router-dom';
import { FileTree } from './FileTree';
import type { SiteData } from '../types';

interface LayoutProps {
  siteData: SiteData;
}

export function Layout({ siteData }: LayoutProps) {
  return (
    <div className="layout">
      <aside className="sidebar">
        <header className="sidebar-header">
          <h1 className="site-title">{siteData.siteName}</h1>
        </header>
        <nav className="file-tree-nav">
          <FileTree tree={siteData.tree} />
        </nav>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
