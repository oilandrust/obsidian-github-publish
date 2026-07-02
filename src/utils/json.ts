export function parseJson<T>(text: string): T {
  const parsed: unknown = JSON.parse(text);
  return parsed as T;
}
