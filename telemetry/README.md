# GitHub Publish telemetry

Anonymous server-side counters for site publish activity. No user, vault, repository, or IP data is stored.

## Events

| Event | Source | Meaning |
|-------|--------|---------|
| `publish` | Site `deploy.yml` on first push | Initial site publish (`Initial publish from Obsidian` commit) |
| `update` | Site `deploy.yml` on later pushes | Incremental publish or manual workflow dispatch |

Each published site's GitHub Actions workflow sends one `POST /v1/event` at the start of the build job.

## Deploy (Cloudflare Workers + KV)

1. Install dependencies:

```bash
cd telemetry/worker
npm install
```

2. Create a KV namespace and update `wrangler.toml` (if not already done):

```bash
npx wrangler kv namespace create TELEMETRY_KV
```

3. Deploy the worker:

```bash
npm run deploy
```

4. Set secrets (choose long random strings):

```bash
npx wrangler secret put TELEMETRY_TOKEN
npx wrangler secret put TELEMETRY_ADMIN_TOKEN
```

5. Put the same ingest URL and token in [`src/telemetry/ingest.ts`](../src/telemetry/ingest.ts). These are embedded into each site's `deploy.yml` when published (write-only counter access).

Or run the setup helper after registering a workers.dev subdomain:

```bash
bash telemetry/worker/scripts/setup-remote.sh
```

## View statistics

### Dashboard

Open the worker root URL in a browser:

```
https://github-publish-telemetry.<subdomain>.workers.dev/
```

Enter the **admin token** (`TELEMETRY_ADMIN_TOKEN`) and click **Load stats**.

### JSON API

```bash
curl -sS \
  -H "Authorization: Bearer $TELEMETRY_ADMIN_TOKEN" \
  "https://<your-worker>.workers.dev/v1/stats"
```

Response shape:

```json
{
  "generatedAt": "2026-07-08T12:00:00.000Z",
  "totals": { "publish": 3, "update": 42 },
  "byDay": { "2026-07-08": { "publish": 1, "update": 5 } },
  "byVersion": {}
}
```

## Record an event manually

```bash
curl -sS -X POST "https://<your-worker>.workers.dev/v1/event" \
  -H "Authorization: Bearer $TELEMETRY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"event":"publish"}'
```

## Existing published sites

Sites created before telemetry was added need an updated `.github/workflows/deploy.yml`. Re-publish the toolchain overlay (see `scripts/upgrade-site-toolchain.mjs`) or publish a site again after upgrading the plugin.

## Local development

```bash
cd telemetry/worker
npm run dev
```

Create a `.dev.vars` file:

```
TELEMETRY_TOKEN=dev-token
TELEMETRY_ADMIN_TOKEN=dev-admin-token
```
