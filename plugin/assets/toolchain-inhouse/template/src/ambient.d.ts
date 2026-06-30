declare module 'react' {
  export type ReactNode =
    | string
    | number
    | boolean
    | null
    | undefined
    | ReactElement
    | ReactNode[];

  export interface ReactElement {
    type: unknown;
    props: unknown;
    key: string | null;
  }

  export type SetStateAction<S> = S | ((prevState: S) => S);
  export type Dispatch<A> = (value: A) => void;
  export type CSSProperties = Record<string, string | number | undefined>;

  export function useState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  export function useEffect(
    effect: () => void | (() => void),
    deps?: ReadonlyArray<unknown>,
  ): void;
}

declare module 'react-router-dom' {
  import type { CSSProperties, ReactNode } from 'react';

  export interface Location {
    pathname: string;
  }

  export function useLocation(): Location;
  export function Navigate(props: { to: string; replace?: boolean }): ReactNode;
  export function Route(props: {
    path?: string;
    index?: boolean;
    element?: ReactNode;
    children?: ReactNode;
  }): ReactNode;
  export function Routes(props: { children?: ReactNode }): ReactNode;
  export function NavLink(props: {
    to: string;
    className?: string | ((state: { isActive: boolean }) => string);
    style?: CSSProperties;
    children?: ReactNode;
  }): ReactNode;
}

interface ImportMetaEnv {
  readonly BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
