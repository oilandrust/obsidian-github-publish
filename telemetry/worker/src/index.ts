interface Env {
  TELEMETRY_KV: KVNamespace;
  TELEMETRY_TOKEN: string;
  TELEMETRY_ADMIN_TOKEN: string;
}

type TelemetryEvent = 'publish' | 'update';

interface EventBody {
  event?: unknown;
  version?: unknown;
}

interface StatsPayload {
  generatedAt: string;
  totals: Record<TelemetryEvent, number>;
  byDay: Record<string, Partial<Record<TelemetryEvent, number>>>;
  byVersion: Record<string, Partial<Record<TelemetryEvent, number>>>;
}

const ALLOWED_EVENTS: ReadonlySet<TelemetryEvent> = new Set(['publish', 'update']);

function isTelemetryEvent(value: string): value is TelemetryEvent {
  return value === 'publish' || value === 'update';
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function authorizeBearer(request: Request, expected: string | undefined): boolean {
  if (!expected) {
    return false;
  }
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return false;
  }
  return auth.slice('Bearer '.length) === expected;
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function lastNDays(days: number): string[] {
  const result: string[] = [];
  for (let offset = 0; offset < days; offset++) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - offset);
    result.push(date.toISOString().slice(0, 10));
  }
  return result;
}

async function readCounter(kv: KVNamespace, key: string): Promise<number> {
  const raw = await kv.get(key);
  if (!raw) {
    return 0;
  }
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : 0;
}

async function incrementCounter(kv: KVNamespace, key: string): Promise<void> {
  const current = await readCounter(kv, key);
  await kv.put(key, String(current + 1));
}

function isEventBody(value: unknown): value is EventBody {
  return typeof value === 'object' && value !== null;
}

function parseEventBody(body: EventBody): { event: TelemetryEvent; version?: string } | null {
  if (typeof body.event !== 'string' || !isTelemetryEvent(body.event)) {
    return null;
  }
  if (body.version !== undefined && typeof body.version !== 'string') {
    return null;
  }
  const version = typeof body.version === 'string' ? body.version.trim() : undefined;
  if (version !== undefined && !/^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
    return null;
  }
  return version ? { event: body.event, version } : { event: body.event };
}

async function recordEvent(
  kv: KVNamespace,
  event: TelemetryEvent,
  version?: string,
): Promise<void> {
  const day = todayUtc();
  await incrementCounter(kv, `total:${event}`);
  await incrementCounter(kv, `day:${day}:${event}`);
  if (version) {
    await incrementCounter(kv, `version:${version}:${event}`);
  }
}

async function collectStats(kv: KVNamespace): Promise<StatsPayload> {
  const totals: Record<TelemetryEvent, number> = { publish: 0, update: 0 };
  const byDay: StatsPayload['byDay'] = {};
  const byVersion: StatsPayload['byVersion'] = {};

  for (const event of ALLOWED_EVENTS) {
    totals[event] = await readCounter(kv, `total:${event}`);
  }

  for (const day of lastNDays(30)) {
    const dayCounts: Partial<Record<TelemetryEvent, number>> = {};
    for (const event of ALLOWED_EVENTS) {
      const count = await readCounter(kv, `day:${day}:${event}`);
      if (count > 0) {
        dayCounts[event] = count;
      }
    }
    if (Object.keys(dayCounts).length > 0) {
      byDay[day] = dayCounts;
    }
  }

  let cursor: string | undefined;
  do {
    const listed = await kv.list({ prefix: 'version:', cursor });
    for (const key of listed.keys) {
      const match = /^version:(.+):([^:]+)$/.exec(key.name);
      if (!match) {
        continue;
      }
      const version = match[1];
      const eventName = match[2];
      if (!version || !eventName || !isTelemetryEvent(eventName)) {
        continue;
      }
      const event: TelemetryEvent = eventName;
      if (!byVersion[version]) {
        byVersion[version] = {};
      }
      byVersion[version][event] = await readCounter(kv, key.name);
    }
    cursor = listed.list_complete ? undefined : listed.cursor;
  } while (cursor);

  return {
    generatedAt: new Date().toISOString(),
    totals,
    byDay,
    byVersion,
  };
}

const DASHBOARD_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GitHub Publish Telemetry</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem auto; max-width: 960px; line-height: 1.5; }
    input, button { font: inherit; padding: 0.4rem 0.6rem; }
    pre { background: #f4f4f5; padding: 1rem; overflow: auto; border-radius: 8px; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
    .muted { color: #666; }
  </style>
</head>
<body>
  <h1>GitHub Publish Telemetry</h1>
  <p class="muted">Anonymous counters only. No user, vault, or repository data is stored.</p>
  <p>
    <label>Admin token:
      <input id="token" type="password" size="48" placeholder="Bearer admin token" />
    </label>
    <button id="load">Load stats</button>
  </p>
  <div id="output" class="muted">Enter the admin token and click Load stats.</div>
  <script>
    const tokenInput = document.getElementById('token');
    const output = document.getElementById('output');
    document.getElementById('load').addEventListener('click', async () => {
      const token = tokenInput.value.trim();
      if (!token) {
        output.textContent = 'Admin token is required.';
        return;
      }
      output.textContent = 'Loading…';
      try {
        const response = await fetch('/v1/stats', {
          headers: { Authorization: 'Bearer ' + token },
        });
        const text = await response.text();
        if (!response.ok) {
          output.textContent = 'Error ' + response.status + ': ' + text;
          return;
        }
        const data = JSON.parse(text);
        const totals = data.totals || {};
        const rows = Object.entries(totals).map(([event, count]) =>
          '<tr><td>' + event + '</td><td>' + count + '</td></tr>'
        ).join('');
        output.innerHTML =
          '<h2>Totals</h2><table><thead><tr><th>Event</th><th>Count</th></tr></thead><tbody>' +
          rows +
          '</tbody></table><h2>Raw JSON</h2><pre>' +
          JSON.stringify(data, null, 2) +
          '</pre>';
      } catch (error) {
        output.textContent = String(error);
      }
    });
  </script>
</body>
</html>`;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/') {
      return html(DASHBOARD_HTML);
    }

    if (url.pathname === '/v1/event' && request.method === 'POST') {
      if (!authorizeBearer(request, env.TELEMETRY_TOKEN)) {
        return json({ error: 'unauthorized' }, 401);
      }

      let rawBody: unknown;
      try {
        rawBody = await request.json();
      } catch {
        return json({ error: 'invalid_json' }, 400);
      }

      if (!isEventBody(rawBody)) {
        return json({ error: 'invalid_json' }, 400);
      }

      const parsed = parseEventBody(rawBody);
      if (!parsed) {
        return json({ error: 'invalid_event' }, 400);
      }

      await recordEvent(env.TELEMETRY_KV, parsed.event, parsed.version);
      return new Response(null, { status: 204 });
    }

    if (url.pathname === '/v1/stats' && request.method === 'GET') {
      if (!authorizeBearer(request, env.TELEMETRY_ADMIN_TOKEN)) {
        return json({ error: 'unauthorized' }, 401);
      }

      const stats = await collectStats(env.TELEMETRY_KV);
      return json(stats);
    }

    return json({ error: 'not_found' }, 404);
  },
};
