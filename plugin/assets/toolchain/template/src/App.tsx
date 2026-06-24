import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { ContentView } from './components/ContentView';
import { Layout } from './components/Layout';
import {
  findFirstNavigableNode,
  findNodeById,
  type AssetNode,
  type NoteNode,
  type SiteData,
} from './types';

function Viewer({ siteData }: { siteData: SiteData }) {
  const { id } = useParams<{ id: string }>();
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

  return <ContentView node={node as NoteNode | AssetNode} />;
}

export default function App() {
  const [siteData, setSiteData] = useState<SiteData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/site-data.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load site data (${res.status})`);
        return res.json();
      })
      .then((data: SiteData) => {
        document.title = data.siteName;
        setSiteData(data);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="app-error">
        <h1>Failed to load site</h1>
        <p>{error}</p>
        <p className="app-error-hint">Run the build script to generate site-data.json.</p>
      </div>
    );
  }

  if (!siteData) {
    return <div className="app-loading">Loading…</div>;
  }

  return (
    <Routes>
      <Route path="/" element={<Layout siteData={siteData} />}>
        <Route index element={<Navigate to="/view" replace />} />
        <Route path="view" element={<Viewer siteData={siteData} />} />
        <Route path="view/:id" element={<Viewer siteData={siteData} />} />
      </Route>
    </Routes>
  );
}
