const http = require('http');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3333;
const HOST = process.env.HOST || '127.0.0.1';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

function readJsonFixture(filename) {
  const filePath = path.join(FIXTURES_DIR, filename);
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

const enginesFixture = readJsonFixture('engines.json');
const preflightSample = readJsonFixture('preflight-veo3-8s-1080p.json');

const enginesMap = enginesFixture.engines.reduce((acc, engine) => {
  acc[engine.id] = engine;
  return acc;
}, {});

function resolveMode(engine, mode) {
  if (mode && engine.modes.includes(mode)) return mode;
  return engine.modes[0];
}

function fieldAppliesToMode(field, mode) {
  if (!field) return false;
  if (Array.isArray(field.modes) && field.modes.length > 0) {
    return field.modes.includes(mode);
  }
  return true;
}

function fieldIsRequired(field, mode, origin) {
  if (Array.isArray(field.requiredInModes) && field.requiredInModes.length > 0) {
    return field.requiredInModes.includes(mode);
  }
  return origin === 'required';
}

function collectSchemaFields(engine, mode) {
  const schema = engine.inputSchema;
  const collected = [];
  if (!schema) return collected;

  const ingest = (fields, origin) => {
    if (!Array.isArray(fields)) return;
    fields.forEach((field) => {
      if (!fieldAppliesToMode(field, mode)) return;
      const required = fieldIsRequired(field, mode, origin);
      collected.push({ field, required, origin });
    });
  };

  ingest(schema.required, 'required');
  ingest(schema.optional, 'optional');
  return collected;
}

function validateInputSchema(engine, payload, { mode, requireAssets }) {
  const activeMode = resolveMode(engine, mode);
  const schemaFields = collectSchemaFields(engine, activeMode);
  if (!schemaFields.length) {
    return { valid: true, mode: activeMode };
  }

  const inputs = Array.isArray(payload?.inputs) ? payload.inputs : [];

  for (const entry of schemaFields) {
    const field = entry.field;
    if (!field) continue;
    if (field.type === 'image' || field.type === 'video') {
      if (!requireAssets || !entry.required) continue;
      const minCount = field.minCount ?? 1;
      const matching = inputs.filter((item) => item && item.slotId === field.id);
      if (matching.length < minCount) {
        return {
          valid: false,
          mode: activeMode,
          error: {
            code: 'missing_input',
            message: `\`${field.id}\` is required for ${engine.label} (${activeMode}).`,
          },
        };
      }
      if (field.maxCount && matching.length > field.maxCount) {
        return {
          valid: false,
          mode: activeMode,
          error: {
            code: 'invalid_input',
            message: `\`${field.id}\` accepts at most ${field.maxCount} file${field.maxCount > 1 ? 's' : ''}.`,
          },
        };
      }
      continue;
    }

    const value = payload ? payload[field.id] : undefined;

    if (field.type === 'text') {
      if (entry.required) {
        if (typeof value !== 'string' || !value.trim()) {
          return {
            valid: false,
            mode: activeMode,
            error: {
              code: 'missing_input',
              message: `\`${field.id}\` is required for ${engine.label} (${activeMode}).`,
            },
          };
        }
      }
      continue;
    }

    if (field.type === 'number') {
      if (value === undefined || value === null) {
        if (entry.required) {
          return {
            valid: false,
            mode: activeMode,
            error: {
              code: 'missing_input',
              message: `\`${field.id}\` is required for ${engine.label} (${activeMode}).`,
            },
          };
        }
        continue;
      }
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return {
          valid: false,
          mode: activeMode,
          error: {
            code: 'invalid_input',
            message: `\`${field.id}\` must be a number.`,
          },
        };
      }
      if (field.min != null && value < field.min) {
        return {
          valid: false,
          mode: activeMode,
          error: {
            code: 'invalid_input',
            message: `\`${field.id}\` must be ≥ ${field.min}.`,
          },
        };
      }
      if (field.max != null && value > field.max) {
        return {
          valid: false,
          mode: activeMode,
          error: {
            code: 'invalid_input',
            message: `\`${field.id}\` must be ≤ ${field.max}.`,
          },
        };
      }
      continue;
    }

    if (field.type === 'enum') {
      if (value === undefined || value === null || value === '') {
        if (entry.required) {
          return {
            valid: false,
            mode: activeMode,
            error: {
              code: 'missing_input',
              message: `\`${field.id}\` is required for ${engine.label} (${activeMode}).`,
            },
          };
        }
        continue;
      }
      if (!Array.isArray(field.values) || !field.values.includes(value)) {
        return {
          valid: false,
          mode: activeMode,
          error: {
            code: 'invalid_input',
            message: `\`${value}\` is not supported for \`${field.id}\`.`,
          },
        };
      }
    }
  }

  return { valid: true, mode: activeMode };
}

function buildPreflight(body) {
  const errors = [];
  const {
    engine: engineId,
    mode,
    durationSec,
    resolution,
    aspectRatio,
    fps,
    addons = {},
    seedLocked = false,
    user = {}
  } = body || {};

  const engine = enginesMap[engineId];
  if (!engine) {
    return {
      status: 400,
      payload: {
        ok: false,
        error: {
          code: 'UNKNOWN_ENGINE',
          message: `Engine ${engineId} is not available.`,
          suggestions: Object.keys(enginesMap).map((id) => ({ engine: id }))
        }
      }
    };
  }

  const requestedMode = typeof mode === 'string' ? mode : null;
  if (!requestedMode || !engine.modes.includes(requestedMode)) {
    return {
      status: 400,
      payload: {
        ok: false,
        error: {
          code: 'UNSUPPORTED_MODE',
          message: `Mode ${mode} not supported for engine ${engine.label}.`,
          suggestions: engine.modes.map((supported) => ({ mode: supported }))
        }
      }
    };
  }

  const schemaValidation = validateInputSchema(engine, body, { mode: requestedMode, requireAssets: false });
  if (!schemaValidation.valid) {
    return {
      status: 400,
      payload: {
        ok: false,
        error: {
          code: schemaValidation.error.code,
          message: schemaValidation.error.message,
        },
      },
    };
  }

  const activeMode = schemaValidation.mode;

  if (typeof durationSec !== 'number' || durationSec <= 0) {
    errors.push('Duration must be a positive number of seconds.');
  } else if (engine.maxDurationSec && durationSec > engine.maxDurationSec) {
    return {
      status: 400,
      payload: {
        ok: false,
        error: {
          code: 'UNSUPPORTED_COMBO',
          message: `Duration ${durationSec}s not supported at ${resolution} for this engine.`,
          suggestions: [
            { durationSec: engine.maxDurationSec }
          ]
        }
      }
    };
  }

  if (resolution && !engine.resolutions.includes(resolution)) {
    return {
      status: 400,
      payload: {
        ok: false,
        error: {
          code: 'UNSUPPORTED_RESOLUTION',
          message: `Resolution ${resolution} not supported for ${engine.label}.`,
          suggestions: engine.resolutions.map((res) => ({ resolution: res }))
        }
      }
    };
  }

  if (aspectRatio && !engine.aspectRatios.includes(aspectRatio)) {
    return {
      status: 400,
      payload: {
        ok: false,
        error: {
          code: 'UNSUPPORTED_ASPECT_RATIO',
          message: `Aspect ratio ${aspectRatio} not supported for ${engine.label}.`,
          suggestions: engine.aspectRatios.map((ar) => ({ aspectRatio: ar }))
        }
      }
    };
  }

  if (fps && !engine.fps.includes(fps)) {
    return {
      status: 400,
      payload: {
        ok: false,
        error: {
          code: 'UNSUPPORTED_FPS',
          message: `FPS ${fps} not supported for ${engine.label}.`,
          suggestions: engine.fps.map((value) => ({ fps: value }))
        }
      }
    };
  }

  if (addons.audio && !engine.audio) {
    return {
      status: 400,
      payload: {
        ok: false,
        error: {
          code: 'AUDIO_UNSUPPORTED',
          message: `${engine.label} does not support audio generation.`,
          suggestions: enginesFixture.engines
            .filter((entry) => entry.audio)
            .map((entry) => ({ engine: entry.id }))
        }
      }
    };
  }

  if (addons.upscale4k && !engine.upscale4k) {
    return {
      status: 400,
      payload: {
        ok: false,
        error: {
          code: 'UPSCALE_UNSUPPORTED',
          message: `${engine.label} does not support 4K upscaling.`,
          suggestions: enginesFixture.engines
            .filter((entry) => entry.upscale4k)
            .map((entry) => ({ engine: entry.id }))
        }
      }
    };
  }

  if (errors.length) {
    return {
      status: 400,
      payload: {
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: errors.join(' ')
        }
      }
    };
  }

  const pricing = engine.pricing || {};
  let baseRate = 0;
  if (pricing.byResolution && resolution && pricing.byResolution[resolution]) {
    baseRate = pricing.byResolution[resolution];
  } else if (typeof pricing.base === 'number') {
    baseRate = pricing.base;
  } else {
    baseRate = 0.05; // conservative fallback for mocks
  }

  const seconds = durationSec || engine.maxDurationSec || 1;
  const baseSubtotal = roundCurrency(baseRate * seconds);

  const addonsItemization = [];
  let addonsTotal = 0;

  if (addons.audio) {
    const audioSubtotal = engine.audio ? 0 : 0; // placeholder; audio engine includes cost
    addonsItemization.push({ type: 'audio', mode: addons.audio === true ? 'generate' : addons.audio, subtotal: audioSubtotal });
    addonsTotal += audioSubtotal;
  }

  if (addons.upscale4k) {
    const upscaleSubtotal = 2.5; // placeholder cost for mock
    addonsItemization.push({ type: 'upscale4k', subtotal: roundCurrency(upscaleSubtotal) });
    addonsTotal += upscaleSubtotal;
  }

  const subtotalBeforeDiscount = roundCurrency(baseSubtotal + addonsTotal);

  const memberTier = user.memberTier || null;
  const tierDiscountRate = getMemberDiscountRate(memberTier);
  const discountAmount = roundCurrency(subtotalBeforeDiscount * tierDiscountRate);

  const discounts = tierDiscountRate > 0 ? [
    {
      type: 'member',
      tier: memberTier,
      rate: tierDiscountRate,
      amount: -discountAmount
    }
  ] : [];

  const total = roundCurrency(subtotalBeforeDiscount - discountAmount);

  const messages = [];
  if (engine.maxDurationSec && durationSec === engine.maxDurationSec && resolution === '1080p') {
    messages.push(`${engine.label} caps duration at ${engine.maxDurationSec}s for ${resolution}.`);
  }

  const response = {
    ok: true,
    currency: 'USD',
    itemization: {
      base: {
        unit: pricing.unit || 'USD/s',
        rate: baseRate,
        seconds,
        subtotal: baseSubtotal
      },
      addons: addonsItemization,
      discounts,
      taxes: []
    },
    total,
    caps: {
      maxDurationSec: engine.maxDurationSec,
      supportedFps: engine.fps
    },
    messages,
    ttlSec: 120
  };

  return {
    status: 200,
    payload: response
  };
}

function getMemberDiscountRate(tier) {
  if (!tier) return 0;
  const normalized = tier.toLowerCase();
  if (normalized === 'plus') return 0.05;
  if (normalized === 'pro') return 0.1;
  if (normalized === 'member') return 0;
  return 0;
}

function roundCurrency(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function matchesSampleRequest(body) {
  if (!body) return false;
  return body.engine === 'veo3' &&
    body.mode === 't2v' &&
    body.durationSec === 8 &&
    body.resolution === '1080p' &&
    body.aspectRatio === '16:9' &&
    body.fps === 24 &&
    Boolean(body.addons && body.addons.upscale4k === false && body.addons.audio === true) &&
    body.seedLocked === false &&
    Boolean(body.user && body.user.memberTier === 'Plus');
}

function paginateJobs(cursor, limit) {
  const dataset = readJsonFixture('jobs.json');
  const jobs = dataset.jobs || [];
  if (!jobs.length) {
    return { ok: true, jobs: [], nextCursor: null };
  }

  let startIndex = 0;
  if (cursor) {
    const index = jobs.findIndex((job) => job.jobId === cursor);
    startIndex = index >= 0 ? index + 1 : 0;
  }

  const slice = jobs.slice(startIndex, startIndex + limit);
  const last = slice[slice.length - 1];
  const nextCursor = startIndex + limit >= jobs.length ? null : last?.jobId ?? null;

  return {
    ok: true,
    jobs: slice,
    nextCursor
  };
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const { method } = req;
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': CORS_ORIGIN,
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  if (method === 'GET' && url.pathname === '/api/engines') {
    return sendJson(res, 200, enginesFixture);
  }

  if (method === 'POST' && url.pathname === '/api/preflight') {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) {
        raw = '';
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: { code: 'PAYLOAD_TOO_LARGE' } }));
        req.destroy();
      }
    });

    req.on('end', () => {
      let body;
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch (err) {
        return sendJson(res, 400, { ok: false, error: { code: 'INVALID_JSON', message: err.message } });
      }

      // shortcut: if request matches fixture exactly, return fixture for deterministic snapshots
      if (matchesSampleRequest(body)) {
        return sendJson(res, 200, preflightSample);
      }

      const { status, payload } = buildPreflight(body);
      return sendJson(res, status, payload);
    });

    return;
  }

  if (method === 'POST' && url.pathname === '/api/generate') {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) {
        raw = '';
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: { code: 'PAYLOAD_TOO_LARGE' } }));
        req.destroy();
      }
    });

    req.on('end', async () => {
      let body;
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch (err) {
        return sendJson(res, 400, { ok: false, error: { code: 'INVALID_JSON', message: err.message } });
      }

      const { engine: engineId } = body || {};
      const engine = enginesMap[engineId];
      if (!engine) {
        return sendJson(res, 400, {
          ok: false,
          error: { code: 'UNKNOWN_ENGINE', message: `Engine ${engineId} is not available.` }
        });
      }

      const requestedMode = typeof body.mode === 'string' ? body.mode : null;
      if (!requestedMode || !engine.modes.includes(requestedMode)) {
        return sendJson(res, 400, {
          ok: false,
          error: {
            code: 'UNSUPPORTED_MODE',
            message: `Mode ${body.mode} not supported for engine ${engine.label}.`,
            suggestions: engine.modes.map((supported) => ({ mode: supported })),
          },
        });
      }

      const validation = validateInputSchema(engine, body, { mode: requestedMode, requireAssets: true });
      if (!validation.valid) {
        return sendJson(res, 400, {
          ok: false,
          error: {
            code: validation.error.code,
            message: validation.error.message,
          },
        });
      }

      const { status, payload } = buildPreflight(body);
      if (status !== 200) {
        return sendJson(res, status, payload);
      }

      const currency = payload.currency ?? 'USD';
      const totalCents = Math.round((payload.total ?? 0) * 100);
      const baseSubtotalDollars = payload.itemization?.base?.subtotal ?? 0;
      const baseSubtotalCents = Math.round(baseSubtotalDollars * 100);
      const addonEntries = payload.itemization?.addons ?? [];
      const addons = addonEntries.map((addon) => ({
        type: addon.type ?? 'addon',
        amountCents: Math.round((addon.subtotal ?? 0) * 100),
      }));
      const addonTotalCents = addons.reduce((sum, item) => sum + item.amountCents, 0);
      const subtotalBeforeDiscountCents = baseSubtotalCents + addonTotalCents;

      const pricing = {
        currency,
        totalCents,
        subtotalBeforeDiscountCents,
        base: {
          seconds: payload.itemization?.base?.seconds ?? body.durationSec ?? 0,
          rate: payload.itemization?.base?.rate ?? 0,
          unit: payload.itemization?.base?.unit,
          amountCents: baseSubtotalCents,
        },
        addons,
        margin: {
          amountCents: Math.max(totalCents - subtotalBeforeDiscountCents, 0),
        },
      };

      const jobId = body.jobId || `job-${Date.now()}`;
      return sendJson(res, 200, {
        ok: true,
        jobId,
        thumbUrl: '/assets/frames/thumb-16x9.svg',
        videoUrl: null,
        pricing,
        paymentStatus: 'pending_payment',
      });
    });

    return;
  }

  if (method === 'GET' && url.pathname === '/api/jobs') {
    const cursor = url.searchParams.get('cursor') || null;
    const limitParam = parseInt(url.searchParams.get('limit') || '24', 10);
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 60) : 24;

    const page = paginateJobs(cursor, limit);
    return sendJson(res, 200, page);
  }

  if (method === 'GET' && url.pathname === '/healthz') {
    return sendJson(res, 200, { ok: true });
  }

  sendJson(res, 404, { ok: false, error: { code: 'NOT_FOUND', message: 'Route not mocked.' } });
});

server.listen(PORT, HOST, () => {
  console.log(`Mock API listening on http://${HOST}:${PORT}`);
});
