import { Notice } from 'obsidian';
import { construct } from '../utils/call';

export function showNotice(message: string): void {
  construct(Notice, message);
}
