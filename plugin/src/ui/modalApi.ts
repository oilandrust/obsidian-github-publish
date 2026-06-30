import { Modal } from 'obsidian';
import { callBound } from '../utils/call';

export function openModal(modal: Modal): void {
  callBound(modal, 'open');
}

export function closeModal(modal: Modal): void {
  callBound(modal, 'close');
}
