/**
 * Public ingest endpoint for anonymous site publish counters.
 * Embedded in each published site's deploy.yml (no auth — counters only).
 */
export const TELEMETRY_INGEST_URL = 'https://github-publish-telemetry.o-rouiller.workers.dev';
