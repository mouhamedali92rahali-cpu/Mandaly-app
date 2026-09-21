const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function isValidCodeShape(code) {
  return typeof code === 'string' && /^MDLY-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code);
}

function isValidDeviceId(id) {
  return typeof id === 'string' && id.length > 0 && id.length <= 100;
}

async function handleActivate(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, reason: 'bad_request' }, 400);
  }

  const code = typeof body.code === 'string' ? body.code.toUpperCase().trim() : '';
  const deviceId = body.deviceId;

  if (!isValidCodeShape(code) || !isValidDeviceId(deviceId)) {
    return json({ ok: false, reason: 'bad_request' }, 400);
  }

  const raw = await env.ACTIVATION_CODES.get(code);
  if (raw === null) {
    return json({ ok: false, reason: 'not_found' }, 404);
  }

  let record;
  try {
    record = JSON.parse(raw);
  } catch {
    record = {};
  }
  if (!Array.isArray(record.devices)) record.devices = [];

  // Same device retrying (e.g. after a flaky connection) — no-op success,
  // doesn't consume another of the two device slots.
  if (record.devices.includes(deviceId)) {
    return json({ ok: true });
  }

  if (record.devices.length >= 2) {
    return json({ ok: false, reason: 'limit_reached' }, 409);
  }

  record.devices.push(deviceId);
  record.lastActivatedAt = new Date().toISOString();
  await env.ACTIVATION_CODES.put(code, JSON.stringify(record));

  return json({ ok: true });
}

// Visiting this URL (with the admin token) in a browser downloads a CSV
// listing every code and how many of its two device slots are used —
// openable directly in Excel, no technical setup needed.
async function handleExport(request, env) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
    return new Response('Unauthorized', { status: 401 });
  }

  const rows = ['code,uses,device1,device2'];
  let cursor;
  for (;;) {
    const list = await env.ACTIVATION_CODES.list({ cursor, limit: 1000 });
    for (const key of list.keys) {
      const raw = await env.ACTIVATION_CODES.get(key.name);
      let devices = [];
      try {
        const record = JSON.parse(raw || '{}');
        if (Array.isArray(record.devices)) devices = record.devices;
      } catch {
        // malformed record — treat as unused rather than failing the export
      }
      rows.push([key.name, devices.length, devices[0] ?? '', devices[1] ?? ''].join(','));
    }
    if (list.list_complete) break;
    cursor = list.cursor;
  }

  return new Response(rows.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="mandaly-codes.csv"',
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }
    if (url.pathname === '/activate' && request.method === 'POST') {
      return handleActivate(request, env);
    }
    if (url.pathname === '/admin/export' && request.method === 'GET') {
      return handleExport(request, env);
    }
    return json({ ok: false, reason: 'not_found' }, 404);
  },
};
