export const DEFAULT_QUARTZ_COMMIT = '9cf87ff1c248a8ca551093214b0fec3b31415009';

export interface QuartzVersionOption {
  sha: string;
  label: string;
}

export const TESTED_QUARTZ_VERSIONS: QuartzVersionOption[] = [
  { sha: DEFAULT_QUARTZ_COMMIT, label: 'Quartz v5 (Jun 2026)' },
];

export function resolveQuartzCommitSha(settingsSha: string | null | undefined): string {
  const trimmed = settingsSha?.trim();
  return trimmed || DEFAULT_QUARTZ_COMMIT;
}

export function getQuartzVersionLabel(sha: string): string {
  const known = TESTED_QUARTZ_VERSIONS.find((version) => version.sha === sha);
  return known?.label ?? `${sha.slice(0, 7)}…`;
}
