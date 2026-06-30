import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { ContentView } from './components/ContentView';
import { Layout } from './components/Layout';
import { findFirstNavigableNode, findNodeById, type SiteData } from './types';

function Viewer({ siteData }: { siteData: SiteData }) {
  const routeId: string | undefined = useParams().id;
  const id = typeof routeId === 'string' ? routeId : undefined;
  const node = id ? findNodeById(siteData.tree, id) : null;

  if (!node || (node.type !== 'note' && node.type !== 'asset')) {
    const first = findFirstNavigableNode(siteData.tree);
    if (first) {
      return <Navigate to={`/view/${first.id}`} replace />;
    }
    return (
      <div className="content-empty">
        <p>No content to display.</p>
      </div>
    );
  }

  return <ContentView node={node} />;
}

export default function App() {
  const [siteData, setSiteData] = useState<SiteData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}data/site-data.json`);
        if (!res.ok) {
          throw new Error(`Failed to load site data (${String(res.status)})`);
        }
        const data = (await res.json()) as SiteData;
        document.title = data.siteName;
        setSiteData(data);
      } catch (err: unknown) {
        setLoadError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, []);

  if (loadError) {
    return (
      <div className="app-error">
        <h1>Failed to load site</h1>
        <p>{loadError}</p>
        <p className="app-error-hint">Run the build script to generate site-data.json.</p>
      </div>
    );
  }

  if (!siteData) {
    return <div className="app-loading">Loading…</div>;
  }

  const data: SiteData = siteData;

  return (
    <Routes>
      <Route path="/" element={<Layout siteData={data} />}>
        <Route index element={<Navigate to="/view" replace />} />
        <Route path="view" element={<Viewer siteData={data} />} />
        <Route path="view/:id" element={<Viewer siteData={data} />} />
      </Route>
    </Routes>
  );
}
