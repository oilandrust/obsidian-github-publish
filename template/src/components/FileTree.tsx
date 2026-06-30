import { useState, type ReactElement } from '../react';
import { NavLink } from '../router';
import type { TreeNode } from '../types';
import { h } from '../ui';

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

function FolderItem({
  node,
  depth,
}: {
  key?: string;
  node: Extract<TreeNode, { type: 'folder' }>;
  depth: number;
}): ReactElement {
  const [open, setOpen] = useState(depth < 1);

  return h(
    'li',
    { className: 'tree-folder' },
    h(
      'button',
      {
        type: 'button',
        className: 'tree-folder-toggle',
        style: { paddingLeft: `${String(depth * 12 + 8)}px` },
        onClick: () => {
          setOpen(!open);
        },
        'aria-expanded': open,
      },
      h('span', { className: 'tree-chevron' }, open ? '▾' : '▸'),
      h('span', { className: 'tree-icon' }, nodeIcon(node)),
      h('span', { className: 'tree-label' }, node.name),
    ),
    open ? h(FileTree, { tree: node.children, depth: depth + 1 }) : null,
  );
}

export function FileTree({ tree, depth = 0 }: FileTreeProps): ReactElement {
  return h(
    'ul',
    { className: 'file-tree', role: 'tree' },
    ...tree.map((node) => {
      if (node.type === 'folder') {
        return h(FolderItem, {
          key: `folder-${node.name}-${String(depth)}`,
          node,
          depth,
        });
      }

      return h(
        'li',
        { key: node.id, className: 'tree-item', role: 'treeitem' },
        h(NavLink, {
          to: `/view/${node.id}`,
          className: ({ isActive }: { isActive: boolean }): string =>
            `tree-link${isActive ? ' active' : ''}`,
          style: { paddingLeft: `${String(depth * 12 + 8)}px` },
          children: [
            h('span', { className: 'tree-icon' }, nodeIcon(node)),
            h('span', { className: 'tree-label' }, node.title),
          ],
        }),
      );
    }),
  );
}
