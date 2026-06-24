import type { AssetNode, NoteNode } from '../types';

interface ContentViewProps {
  node: NoteNode | AssetNode;
}

function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}assets/${path.split('/').map(encodeURIComponent).join('/')}`;
}

function AssetViewer({ node }: { node: AssetNode }) {
  const url = assetUrl(node.path);

  if (node.mime.startsWith('image/')) {
    return (
      <div className="asset-viewer">
        <img src={url} alt={node.title} className="asset-image" />
      </div>
    );
  }

  if (node.mime.startsWith('audio/')) {
    return (
      <div className="asset-viewer">
        <h1 className="asset-title">{node.title}</h1>
        <audio controls src={url} className="asset-audio" />
      </div>
    );
  }

  if (node.mime === 'application/pdf') {
    return (
      <div className="asset-viewer asset-viewer-pdf">
        <h1 className="asset-title">{node.title}</h1>
        <iframe src={url} title={node.title} className="asset-pdf" />
      </div>
    );
  }

  return (
    <div className="asset-viewer">
      <h1 className="asset-title">{node.title}</h1>
      <p>
        <a href={url} download>
          Download file
        </a>
      </p>
    </div>
  );
}

export function ContentView({ node }: ContentViewProps) {
  if (node.type === 'asset') {
    return <AssetViewer node={node} />;
  }

  return (
    <article className="note-viewer">
      <div className="prose" dangerouslySetInnerHTML={{ __html: node.html }} />
    </article>
  );
}
