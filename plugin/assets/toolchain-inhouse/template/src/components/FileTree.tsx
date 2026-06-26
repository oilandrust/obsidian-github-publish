import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import type { TreeNode } from '../types';

interface FileTreeProps {
  tree: TreeNode[];
  depth?: number;
}

function nodeIcon(node: TreeNode): string {
  if (node.type === 'folder') return '📁';
  if (node.type === 'note') return '📄';
  if (node.mime.startsWith('image/')) return '🖼';
  if (node.mime.startsWith('audio/')) return '🎵';
  if (node.mime === 'application/pdf') return '📕';
  return '📎';
}

function FolderItem({ node, depth }: { node: Extract<TreeNode, { type: 'folder' }>; depth: number }) {
  const [open, setOpen] = useState(depth < 1);

  return (
    <li className="tree-folder">
      <button
        type="button"
        className="tree-folder-toggle"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="tree-chevron">{open ? '▾' : '▸'}</span>
        <span className="tree-icon">{nodeIcon(node)}</span>
        <span className="tree-label">{node.name}</span>
      </button>
      {open && <FileTree tree={node.children} depth={depth + 1} />}
    </li>
  );
}

export function FileTree({ tree, depth = 0 }: FileTreeProps) {
  return (
    <ul className="file-tree" role="tree">
      {tree.map((node) => {
        if (node.type === 'folder') {
          return <FolderItem key={`folder-${node.name}-${depth}`} node={node} depth={depth} />;
        }

        return (
          <li key={node.id} className="tree-item" role="treeitem">
            <NavLink
              to={`/view/${node.id}`}
              className={({ isActive }) => `tree-link${isActive ? ' active' : ''}`}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
              <span className="tree-icon">{nodeIcon(node)}</span>
              <span className="tree-label">{node.title}</span>
            </NavLink>
          </li>
        );
      })}
    </ul>
  );
}
