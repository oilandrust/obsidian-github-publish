import { createElement, type ComponentType, type ReactElement, type ReactNode } from 'react';

type Props = Record<string, unknown> | null;

export function h(
  type: string | ComponentType<Record<string, unknown>>,
  props: Props,
  ...children: ReactNode[]
): ReactElement {
  const node: unknown = createElement(type, props, ...children);
  return node as ReactElement;
}
