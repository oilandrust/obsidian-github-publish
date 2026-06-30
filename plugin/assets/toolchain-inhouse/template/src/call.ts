export function callBound(obj: unknown, method: string, ...args: unknown[]): unknown {
  if (obj === null || (typeof obj !== 'object' && typeof obj !== 'function')) {
    throw new TypeError('callBound expects object');
  }
  const fn: unknown = Reflect.get(obj, method);
  if (typeof fn !== 'function') {
    throw new TypeError(`Method not found: ${method}`);
  }
  return Reflect.apply(fn as (...args: unknown[]) => unknown, obj, args);
}

export function callFn(fn: unknown, ...args: unknown[]): unknown {
  if (typeof fn !== 'function') {
    throw new TypeError('callFn expects function');
  }
  return Reflect.apply(fn as (...args: unknown[]) => unknown, undefined, args);
}
