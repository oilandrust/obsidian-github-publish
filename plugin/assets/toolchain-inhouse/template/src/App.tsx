import { useEffect, useState, type ComponentType, type ReactElement } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ContentView } from './components/ContentView';
import { Layout } from './components/Layout';
import { findFirstNavigableNode, findNodeById, type SiteData } from './types';
import { h } from './ui';

const Nav = Navigate as ComponentType<Record<string, unknown>>;
const AppRoute = Route as ComponentType<Record<string, unknown>>;
const AppRoutes = Routes as ComponentType<Record<string, unknown>>;
const AppLayout = Layout as ComponentType<Record<string, unknown>>;
const AppContentView = ContentView as ComponentType<Record<string, unknown>>;

function viewIdFromPath(pathname: string): string | undefined {
  const match = /\/view\/([^/?#]+)/.exec(pathname);
  return match?.[1];
}

function Viewer({ siteData }: { siteData: SiteData }): ReactElement {
  const pathname: string = useLocation().pathname;
  const id = viewIdFromPath(pathname);
  const node = id ? findNodeById(siteData.tree, id) : null;

  if (!node || (node.type !== 'note' && node.type !== 'asset')) {
    const first = findFirstNavigableNode(siteData.tree);
    if (first) {
      return h(Nav, { to: `/view/${first.id}`, replace: true });
    }
    return h('div', { className: 'content-empty' }, h('p', null, 'No content to display.'));
  }

  return h(AppContentView, { node });
}

const ViewerComp = Viewer as ComponentType<Record<string, unknown>>;

async function loadSiteData(baseUrl: string): Promise<SiteData> {
  const res = await fetch(`${baseUrl}data/site-data.json`);
  if (!res.ok) {
    throw new Error(`Failed to load site data (${String(res.status)})`);
  }
  const json: unknown = await res.json();
  return json as SiteData;
}

export default function App(): ReactElement {
  const [siteData, setSiteData] = useState<SiteData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    void loadSiteData(import.meta.env.BASE_URL)
      .then((data) => {
        document.title = data.siteName;
        setSiteData(data);
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  if (loadError) {
    return h(
      'div',
      { className: 'app-error' },
      h('h1', null, 'Failed to load site'),
      h('p', null, loadError),
      h('p', { className: 'app-error-hint' }, 'Run the build script to generate site-data.json.'),
    );
  }

  if (!siteData) {
    return h('div', { className: 'app-loading' }, 'Loading…');
  }

  const data: SiteData = siteData;

  return h(
    AppRoutes,
    null,
    h(
      AppRoute,
      { path: '/', element: h(AppLayout, { siteData: data }) },
      h(AppRoute, { index: true, element: h(Nav, { to: '/view', replace: true }) }),
      h(AppRoute, { path: 'view', element: h(ViewerComp, { siteData: data }) }),
      h(AppRoute, { path: 'view/:id', element: h(ViewerComp, { siteData: data }) }),
    ),
  );
}
