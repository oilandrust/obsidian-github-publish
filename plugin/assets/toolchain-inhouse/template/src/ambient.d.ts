import type { CSSProperties, ReactNode } from 'react';

declare module 'react-router-dom' {
  export interface Params {
    [key: string]: string | undefined;
  }

  export function useParams(): Params;
  export function useLocation(): { pathname: string };
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
