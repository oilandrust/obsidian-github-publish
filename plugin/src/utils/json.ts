export function parseJson<T>(text: string): T {
  return JSON.parse(text) as T;
}
