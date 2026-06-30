import { callBound } from '../utils/call';

export function elEmpty(el: HTMLElement): void {
  callBound(el, 'empty');
}

export function elAddClass(el: HTMLElement, ...classes: string[]): void {
  callBound(el, 'addClass', ...classes);
}

export function elRemoveClass(el: HTMLElement, ...classes: string[]): void {
  callBound(el, 'removeClass', ...classes);
}

export function elSetText(el: HTMLElement, text: string): void {
  callBound(el, 'setText', text);
}

export function elSetAttr(el: HTMLElement, name: string, value: string): void {
  callBound(el, 'setAttr', name, value);
}

export function focusElement(el: HTMLElement): void {
  callBound(el, 'focus');
}
