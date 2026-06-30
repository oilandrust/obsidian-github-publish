import {
  useState as useStateImpl,
  useEffect as useEffectImpl,
  StrictMode as StrictModeImpl,
  createElement as createElementImpl,
  type ComponentType,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createRoot as createRootImpl } from 'react-dom/client';
import { callFn } from './call';

export type { ComponentType, ReactElement, ReactNode };

type SetState<T> = (value: T | ((prev: T) => T)) => void;

export function useState<T>(initial: T): [T, SetState<T>] {
  const state: unknown = callFn(useStateImpl, initial);
  return state as [T, SetState<T>];
}

export function useEffect(effect: () => void | (() => void), deps?: unknown[]): void {
  callFn(useEffectImpl, effect, deps);
}

export const StrictMode = StrictModeImpl as ComponentType<Record<string, unknown>>;

export interface ReactRoot {
  render(node: ReactElement): void;
}

function callBound(obj: unknown, method: string, ...args: unknown[]): unknown {
  if (obj === null || (typeof obj !== 'object' && typeof obj !== 'function')) {
    throw new TypeError('callBound expects object');
  }
  const fn: unknown = Reflect.get(obj, method);
  if (typeof fn !== 'function') {
    throw new TypeError(`Method not found: ${method}`);
  }
  return Reflect.apply(fn as (...args: unknown[]) => unknown, obj, args);
}

export function createRoot(container: HTMLElement): ReactRoot {
  const root: unknown = callFn(createRootImpl, container);
  return {
    render(node: ReactElement): void {
      callFn(callBound(root, 'render'), node);
    },
  };
}

export function h<P extends Record<string, unknown>>(
  type: string | ComponentType<P>,
  props: P | null,
  ...children: ReactNode[]
): ReactElement {
  const node: unknown = callFn(createElementImpl, type, props, ...children);
  return node as ReactElement;
}
