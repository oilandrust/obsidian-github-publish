/**
 * Public ingest endpoint for anonymous site publish counters.
 * Embedded in each published site's deploy.yml — not a secret, only increments counters.
 */
export const TELEMETRY_INGEST_URL = 'https://github-publish-telemetry.o-rouiller.workers.dev';
export const TELEMETRY_INGEST_TOKEN =
  'b8345e942987e66c4874d69911d202a7fa91512591c78880cef38b50740d33a2';
