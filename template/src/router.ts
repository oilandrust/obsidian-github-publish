import type { ComponentType } from 'react';
import {
  HashRouter as HashRouterImpl,
  Navigate as NavigateImpl,
  NavLink as NavLinkImpl,
  Outlet as OutletImpl,
  Route as RouteImpl,
  Routes as RoutesImpl,
  useLocation as useLocationImpl,
} from 'react-router-dom';
import { callFn } from './call';

function asRouterComponent(value: unknown): ComponentType<Record<string, unknown>> {
  return value as ComponentType<Record<string, unknown>>;
}

export const HashRouter = asRouterComponent(HashRouterImpl as unknown);
export const Navigate = asRouterComponent(NavigateImpl as unknown);
export const Route = asRouterComponent(RouteImpl as unknown);
export const Routes = asRouterComponent(RoutesImpl as unknown);
export const NavLink = asRouterComponent(NavLinkImpl as unknown);
export const Outlet = asRouterComponent(OutletImpl as unknown);

export function useAppLocation(): { pathname: string } {
  const raw: unknown = callFn(useLocationImpl);
  return raw as { pathname: string };
}
