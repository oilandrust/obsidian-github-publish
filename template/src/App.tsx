import { useEffect, useState, h, type ReactElement } from './react';
import { ContentView } from './components/ContentView';
import { Layout } from './components/Layout';
import { Navigate, Route, Routes, useAppLocation } from './router';
import { findFirstNavigableNode, findNodeById, type SiteData } from './types';

function viewIdFromPath(pathname: string): string | undefined {
  const match = /\/view\/([^/?#]+)/.exec(pathname);
  return match?.[1];
}

function Viewer({ siteData }: { siteData: SiteData }): ReactElement {
  const { pathname } = useAppLocation();
  const id = viewIdFromPath(pathname);
  const node = id ? findNodeById(siteData.tree, id) : null;

  if (!node || (node.type !== 'note' && node.type !== 'asset')) {
    const first = findFirstNavigableNode(siteData.tree);
    if (first) {
      return h(Navigate, { to: `/view/${first.id}`, replace: true });
    }
    return h('div', { className: 'content-empty' }, h('p', null, 'No content to display.'));
  }

  return h(ContentView, { node });
}

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

  return h(
    Routes,
    null,
    h(
      Route,
      { path: '/', element: h(Layout, { siteData }) },
      h(Route, { index: true, element: h(Navigate, { to: '/view', replace: true }) }),
      h(Route, { path: 'view', element: h(Viewer, { siteData }) }),
      h(Route, { path: 'view/:id', element: h(Viewer, { siteData }) }),
    ),
  );
}
