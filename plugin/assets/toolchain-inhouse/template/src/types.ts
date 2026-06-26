export type TreeNode = FolderNode | NoteNode | AssetNode;

export interface FolderNode {
  type: 'folder';
  name: string;
  children: TreeNode[];
}

export interface NoteNode {
  type: 'note';
  id: string;
  path: string;
  title: string;
  html: string;
}

export interface AssetNode {
  type: 'asset';
  id: string;
  path: string;
  title: string;
  mime: string;
}

export interface SiteData {
  siteName: string;
  basePath: string;
  tree: TreeNode[];
}

export function isFolder(node: TreeNode): node is FolderNode {
  return node.type === 'folder';
}

export function isNote(node: TreeNode): node is NoteNode {
  return node.type === 'note';
}

export function isAsset(node: TreeNode): node is AssetNode {
  return node.type === 'asset';
}

export function findNodeById(tree: TreeNode[], id: string): TreeNode | null {
  for (const node of tree) {
    if ((node.type === 'note' || node.type === 'asset') && node.id === id) {
      return node;
    }
    if (node.type === 'folder') {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function findFirstNavigableNode(tree: TreeNode[]): NoteNode | AssetNode | null {
  for (const node of tree) {
    if (node.type === 'note' || node.type === 'asset') {
      return node;
    }
    if (node.type === 'folder') {
      const found = findFirstNavigableNode(node.children);
      if (found) return found;
    }
  }
  return null;
}
