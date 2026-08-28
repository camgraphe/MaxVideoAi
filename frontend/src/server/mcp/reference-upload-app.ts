import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export const REFERENCE_UPLOAD_APP_URI = 'ui://maxvideoai/reference-upload-v1.html';

const CONNECT_DOMAINS = [
  'https://maxvideoai.com',
  'https://api.maxvideoai.com',
  'https://maxvideoai-mcp-staging.vercel.app',
];

export function buildReferenceUploadAppHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Import private references</title>
    <style>
      :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; padding: 12px; background: transparent; color: #17191f; }
      .card { border: 1px solid rgba(17,24,39,.14); border-radius: 14px; padding: 16px; background: #fff; }
      h1 { margin: 0; font-size: 17px; }
      p { margin: 7px 0 0; color: #626875; font-size: 13px; line-height: 1.45; }
      label { display: flex; min-height: 96px; margin-top: 14px; padding: 16px; align-items: center; justify-content: center; border: 1px dashed #aeb5c2; border-radius: 12px; cursor: pointer; text-align: center; }
      input { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip: rect(0 0 0 0); }
      button { width: 100%; margin-top: 12px; border: 0; border-radius: 10px; padding: 11px 14px; background: #111827; color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
      button:disabled { cursor: not-allowed; opacity: .5; }
      ul { margin: 12px 0 0; padding-left: 20px; font-size: 12px; line-height: 1.55; }
      .error { color: #b42318; }
      @media (prefers-color-scheme: dark) {
        body { color: #f7f8fb; }
        .card { background: #1d2027; border-color: rgba(255,255,255,.14); }
        p { color: #aab1be; }
        button { background: #f7f8fb; color: #111827; }
      }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>Import private references</h1>
      <p id="summary">Choose up to 8 files. They are saved in your connected MaxVideoAI library.</p>
      <label for="files"><span id="selection">Choose files</span></label>
      <input id="files" type="file" multiple />
      <button id="upload" type="button" disabled>Add to MaxVideoAI</button>
      <p id="error" class="error" role="alert"></p>
      <ul id="results"></ul>
    </main>
    <script>
      const input = document.getElementById('files');
      const selection = document.getElementById('selection');
      const upload = document.getElementById('upload');
      const error = document.getElementById('error');
      const results = document.getElementById('results');
      let handoff = null;
      let requestId = 1;
      let initialized = false;
      const pendingRequests = new Map();
      const trustedOrigins = new Set(${JSON.stringify(CONNECT_DOMAINS)});

      function record(value) {
        return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
      }

      function request(method, params) {
        const id = requestId++;
        window.parent.postMessage({ jsonrpc: '2.0', id, method, params }, '*');
        return new Promise((resolve, reject) => pendingRequests.set(id, { resolve, reject }));
      }

      function notify(method, params) {
        const message = { jsonrpc: '2.0', method };
        if (params !== undefined) message.params = params;
        window.parent.postMessage(message, '*');
      }

      function renderHandoff(value) {
        const candidate = record(value);
        const destination = record(candidate?.destination);
        if (
          typeof destination?.url !== 'string'
          || !Number.isSafeInteger(candidate?.maxBytes)
          || candidate.maxBytes < 1
        ) return;
        handoff = candidate;
        const accepted = Array.isArray(candidate.accepted)
          ? candidate.accepted.filter((item) => typeof item === 'string')
          : [];
        input.accept = accepted.join(',');
      }

      function tokenFromHandoff(value) {
        const destination = record(record(value)?.destination);
        if (typeof destination?.url !== 'string') return null;
        try {
          const parsed = new URL(destination.url);
          const match = parsed.pathname.match(
            new RegExp('^/mcp/reference-upload/(mru_[A-Za-z0-9_-]{43})$')
          );
          return parsed.protocol === 'https:'
            && trustedOrigins.has(parsed.origin)
            && !parsed.username
            && !parsed.password
            && !parsed.search
            && !parsed.hash
            && match
            ? { origin: parsed.origin, token: match[1] }
            : null;
        } catch {
          return null;
        }
      }

      async function sha256(bytes) {
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        return Array.from(new Uint8Array(digest))
          .map((byte) => byte.toString(16).padStart(2, '0')).join('');
      }

      async function json(response) {
        const body = await response.json().catch(() => null);
        if (!response.ok || !body || body.ok !== true) {
          throw new Error(typeof body?.error === 'string' ? body.error : 'UPLOAD_FAILED');
        }
        return body;
      }

      async function uploadOne(file, currentHandoff) {
        const capability = tokenFromHandoff(currentHandoff);
        if (!capability) throw new Error('UPLOAD_LINK_INVALID');
        if (
          !Number.isSafeInteger(currentHandoff?.maxBytes)
          || file.size < 1
          || file.size > currentHandoff.maxBytes
        ) throw new Error('FILE_SIZE_INVALID');
        const base = capability.origin + '/api/mcp/reference-upload/' + encodeURIComponent(capability.token);
        const bytes = await file.arrayBuffer();
        const start = await json(await fetch(base + '/start', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + capability.token, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            declaredMime: file.type,
            sizeBytes: file.size,
            fileSha256: await sha256(bytes),
          }),
        }));
        for (let partNumber = 1; partNumber <= start.totalParts; partNumber += 1) {
          const chunk = file.slice(
            (partNumber - 1) * start.chunkBytes,
            Math.min(partNumber * start.chunkBytes, file.size),
          );
          const chunkBytes = await chunk.arrayBuffer();
          await json(await fetch(base + '/part', {
            method: 'POST',
            headers: {
              Authorization: 'Bearer ' + capability.token,
              'Content-Type': 'application/octet-stream',
              'x-upload-id': start.uploadId,
              'x-part-number': String(partNumber),
              'x-content-sha256': await sha256(chunkBytes),
            },
            body: chunkBytes,
          }));
        }
        return json(await fetch(base + '/complete', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + capability.token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ uploadId: start.uploadId }),
        }));
      }

      async function nextHandoff(kind) {
        const result = await request('tools/call', {
          name: 'create_reference_upload_link',
          arguments: { kind },
        });
        const structured = record(record(result)?.structuredContent);
        if (!structured) throw new Error('UPLOAD_LINK_INVALID');
        renderHandoff(structured);
        return structured;
      }

      async function reportAssets(assets) {
        const lines = assets.map((asset) =>
          '- ' + asset.fileName + ': ' + asset.assetId + ' (' + asset.kind + ')'
        );
        await request('ui/update-model-context', {
          content: [{
            type: 'text',
            text: 'Private MaxVideoAI references imported and ready:\\n' + lines.join('\\n'),
          }],
        }).catch(() => undefined);
      }

      input.addEventListener('change', () => {
        const files = Array.from(input.files || []);
        if (files.length > 8) {
          error.textContent = 'Choose no more than 8 files.';
          input.value = '';
          selection.textContent = 'Choose files';
          upload.disabled = true;
          return;
        }
        if (handoff && files.some((file) => file.size < 1 || file.size > handoff.maxBytes)) {
          error.textContent = 'One or more files exceed the private upload limit.';
          upload.disabled = true;
          return;
        }
        error.textContent = '';
        selection.textContent = files.length ? files.length + ' file(s) selected' : 'Choose files';
        upload.disabled = files.length < 1 || !handoff;
      });

      upload.addEventListener('click', async () => {
        const files = Array.from(input.files || []);
        if (!handoff || files.length < 1 || files.length > 8) return;
        upload.disabled = true;
        error.textContent = '';
        results.textContent = '';
        const assets = [];
        const failures = [];
        let current = handoff;
        for (let index = 0; index < files.length; index += 1) {
          const file = files[index];
          try {
            if (index > 0) current = await nextHandoff(current.mediaKind);
            const completed = await uploadOne(file, current);
            const asset = {
              index,
              fileName: file.name,
              assetId: completed.assetId,
              kind: completed.mediaKind,
            };
            assets.push(asset);
            const item = document.createElement('li');
            item.textContent = file.name + ' — ready';
            results.appendChild(item);
          } catch (uploadError) {
            failures.push({ index, fileName: file.name });
            const item = document.createElement('li');
            item.textContent = file.name + ' — failed';
            item.className = 'error';
            results.appendChild(item);
          }
        }
        if (assets.length > 0) {
          await reportAssets(assets);
        }
        selection.textContent = assets.length + ' reference(s) ready';
        error.textContent = failures.length
          ? failures.length + ' file(s) failed. Select only those files to retry.'
          : '';
        upload.disabled = false;
      });

      window.addEventListener('message', (event) => {
        if (event.source !== window.parent) return;
        const message = record(event.data);
        if (!message || message.jsonrpc !== '2.0') return;
        if (pendingRequests.has(message.id)) {
          const pending = pendingRequests.get(message.id);
          pendingRequests.delete(message.id);
          if (message.error) pending.reject(new Error(String(record(message.error)?.message || 'MCP App request failed')));
          else pending.resolve(message.result);
          return;
        }
        if (message.method === 'ui/notifications/tool-result') {
          renderHandoff(record(message.params)?.structuredContent);
          upload.disabled = !(input.files?.length && handoff);
        }
      }, { passive: true });

      async function connect() {
        await request('ui/initialize', {
          appInfo: { name: 'MaxVideoAI private reference import', version: '1.0.0' },
          appCapabilities: {},
          protocolVersion: '2026-01-26',
        });
        notify('ui/notifications/initialized');
        initialized = true;
        void initialized;
      }

      if (window.openai?.toolOutput) renderHandoff(window.openai.toolOutput);
      void connect().catch(() => undefined);
    </script>
  </body>
</html>`;
}

export function registerReferenceUploadApp(server: McpServer): void {
  server.registerResource(
    'maxvideoai-reference-upload',
    REFERENCE_UPLOAD_APP_URI,
    {
      title: 'MaxVideoAI private reference import',
      description: 'Import up to eight private image, video, or audio references.',
      mimeType: 'text/html;profile=mcp-app',
      _meta: {
        ui: {
          prefersBorder: true,
          csp: { connectDomains: CONNECT_DOMAINS, resourceDomains: [] },
        },
      },
    },
    async () => ({
      contents: [{
        uri: REFERENCE_UPLOAD_APP_URI,
        mimeType: 'text/html;profile=mcp-app',
        text: buildReferenceUploadAppHtml(),
        _meta: {
          ui: {
            prefersBorder: true,
            csp: { connectDomains: CONNECT_DOMAINS, resourceDomains: [] },
          },
          'openai/widgetDescription': 'Private multi-file reference import for the connected MaxVideoAI account.',
          'openai/widgetPrefersBorder': true,
          'openai/widgetCSP': {
            connect_domains: CONNECT_DOMAINS,
            resource_domains: [],
          },
        },
      }],
    }),
  );
}
