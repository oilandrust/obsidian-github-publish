export function extname(filePath: string): string {
  const name = filePath.split(/[/\\]/).pop() ?? filePath;
  const index = name.lastIndexOf('.');
  if (index <= 0) {
    return '';
  }
  return name.slice(index);
}
