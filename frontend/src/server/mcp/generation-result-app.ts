import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export const GENERATION_RESULT_APP_URI = 'ui://maxvideoai/generation-result-v3.html';
export const LEGACY_GENERATION_RESULT_APP_URIS = [
  'ui://maxvideoai/generation-result-v1.html',
  'ui://maxvideoai/generation-result-v2.html',
] as const;

const FIXED_MEDIA_ORIGINS = [
  'https://cdn.maxvideoai.com',
  'https://media.maxvideoai.com',
  'https://storage.maxvideoai.com',
] as const;

const FIXED_APP_ORIGINS = [
  'https://maxvideoai.com',
  'https://maxvideoai-mcp-staging.vercel.app',
] as const;

function safeHttpsOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//iu.test(value) ? value : `https://${value}`);
    if (
      url.protocol !== 'https:'
      || url.username
      || url.password
      || url.hash
      || (url.port && url.port !== '443')
    ) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function configuredOrigins(): string[] {
  const candidates = [
    process.env.S3_PUBLIC_BASE_URL,
    process.env.TEST_VIDEO_BASE_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    ...(process.env.ASSET_HOST_ALLOWLIST ?? '').split(',').map((value) => value.trim()),
  ];
  return candidates
    .map(safeHttpsOrigin)
    .filter((origin): origin is string => Boolean(origin));
}

function uniqueOrigins(origins: ReadonlyArray<string>): string[] {
  return Array.from(new Set(origins)).sort();
}

export function generationResultAppResourceDomains(): string[] {
  return uniqueOrigins([...FIXED_MEDIA_ORIGINS, ...FIXED_APP_ORIGINS, ...configuredOrigins()]);
}

export function generationResultAppRedirectDomains(): string[] {
  return uniqueOrigins([...FIXED_APP_ORIGINS, ...configuredOrigins()]);
}

export function buildGenerationResultAppHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>MaxVideoAI generation</title>
    <style>
      :root {
        color-scheme: light dark;
        --page: #ffffff;
        --surface: #f7f8fb;
        --surface-strong: #eef1f7;
        --text: #111827;
        --muted: #667085;
        --border: rgba(17, 24, 39, 0.12);
        --accent: #5b5cf0;
        --success: #157f3b;
        --radius: 16px;
      }

      * { box-sizing: border-box; }

      html, body { margin: 0; min-height: 100%; }

      body {
        background: transparent;
        color: var(--text);
        font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        padding: 2px;
      }

      .card {
        background: var(--page);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        box-shadow: 0 12px 30px rgba(17, 24, 39, 0.08);
        overflow: hidden;
      }

      .header, .details, .actions {
        align-items: center;
        display: flex;
        gap: 12px;
        justify-content: space-between;
      }

      .header { padding: 14px 16px; }

      .brand { font-size: 15px; font-weight: 750; letter-spacing: -0.02em; }

      .status {
        align-items: center;
        background: rgba(21, 127, 59, 0.1);
        border-radius: 999px;
        color: var(--success);
        display: inline-flex;
        font-size: 12px;
        font-weight: 700;
        gap: 6px;
        padding: 6px 9px;
      }

      .status::before {
        background: currentColor;
        border-radius: 50%;
        content: "";
        height: 7px;
        width: 7px;
      }

      .media {
        aspect-ratio: 16 / 9;
        background: #0b0d12;
        overflow: hidden;
        position: relative;
      }

      video, .image {
        display: block;
        height: 100%;
        object-fit: contain;
        width: 100%;
      }

      [hidden] { display: none !important; }

      .empty {
        align-items: center;
        color: #d0d5dd;
        display: flex;
        font-size: 14px;
        height: 100%;
        justify-content: center;
        padding: 24px;
        text-align: center;
      }

      .details {
        background: var(--surface);
        border-top: 1px solid var(--border);
        padding: 13px 16px;
      }

      .detail-label { color: var(--muted); display: block; font-size: 11px; margin-bottom: 3px; }
      .detail-value { font-size: 13px; font-weight: 700; }

      .actions {
        border-top: 1px solid var(--border);
        padding: 12px 16px;
      }

      .saved { color: var(--muted); font-size: 12px; }

      .action-buttons {
        align-items: center;
        display: flex;
        gap: 8px;
      }

      button {
        appearance: none;
        background: var(--text);
        border: 0;
        border-radius: 10px;
        color: var(--page);
        cursor: pointer;
        font: inherit;
        font-size: 13px;
        font-weight: 700;
        padding: 10px 14px;
      }

      button.secondary {
        background: transparent;
        border: 1px solid var(--border);
        color: var(--text);
      }

      button:disabled { cursor: not-allowed; opacity: 0.5; }

      button:focus-visible { outline: 3px solid color-mix(in srgb, var(--accent) 35%, transparent); outline-offset: 2px; }

      @media (prefers-color-scheme: dark) {
        :root {
          --page: #15171c;
          --surface: #1d2027;
          --surface-strong: #242832;
          --text: #f7f8fb;
          --muted: #a6adbb;
          --border: rgba(255, 255, 255, 0.12);
          --success: #69db8f;
        }

        .card { box-shadow: none; }
        button { color: #111827; background: #f7f8fb; }
        button.secondary { background: transparent; color: var(--text); }
      }

      @media (max-width: 520px) {
        .header, .details, .actions { gap: 8px; }
        .details { align-items: flex-start; }
        .actions { align-items: stretch; flex-direction: column; }
        .action-buttons { width: 100%; }
        .action-buttons button { flex: 1; }
      }
    </style>
  </head>
  <body>
    <article class="card" aria-label="MaxVideoAI generation result">
      <header class="header">
        <div class="brand">MaxVideoAI</div>
        <div class="status" id="status">Ready</div>
      </header>
      <section class="media" aria-live="polite">
        <video id="video" controls playsinline preload="metadata" hidden></video>
        <img class="image" id="image" alt="Generated MaxVideoAI result" hidden />
        <div class="empty" id="empty">Waiting for a completed generation result.</div>
      </section>
      <section class="details">
        <div>
          <span class="detail-label">Result</span>
          <span class="detail-value" id="surface">Generation</span>
        </div>
        <div>
          <span class="detail-label">Price</span>
          <span class="detail-value" id="price">—</span>
        </div>
      </section>
      <footer class="actions">
        <span class="saved" id="saved">Saved to your MaxVideoAI library</span>
        <div class="action-buttons">
          <button class="secondary" type="button" id="download" disabled>Download</button>
          <button type="button" id="open" disabled>Open in MaxVideoAI</button>
        </div>
      </footer>
    </article>
    <script>
      const video = document.getElementById('video');
      const image = document.getElementById('image');
      const empty = document.getElementById('empty');
      const status = document.getElementById('status');
      const surface = document.getElementById('surface');
      const price = document.getElementById('price');
      const saved = document.getElementById('saved');
      const downloadButton = document.getElementById('download');
      const openButton = document.getElementById('open');
      let downloadUrl = null;
      let downloadName = 'maxvideoai-generation';
      let downloadExpiresAt = null;
      let currentJobId = null;
      let openUrl = null;
      let requestId = 1;
      let initialized = false;
      let lastWidth = 0;
      let lastHeight = 0;
      const pendingRequests = new Map();

      function record(value) {
        return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
      }

      function safeUrl(value) {
        if (typeof value !== 'string' || value.length > 2048) return null;
        try {
          const parsed = new URL(value);
          return parsed.protocol === 'https:' && !parsed.username && !parsed.password && !parsed.hash
            ? parsed.toString()
            : null;
        } catch {
          return null;
        }
      }

      function money(cents, currency) {
        if (!Number.isSafeInteger(cents) || cents < 0 || typeof currency !== 'string') return '—';
        try {
          return new Intl.NumberFormat(document.documentElement.lang || 'en', {
            style: 'currency',
            currency,
          }).format(cents / 100);
        } catch {
          return (cents / 100).toFixed(2) + ' ' + currency;
        }
      }

      function buildResultLibraryUrl(libraryUrl, jobId, resultSurface) {
        if (
          !libraryUrl
          || typeof jobId !== 'string'
          || !jobId.trim()
          || jobId.length > 256
          || (resultSurface !== 'video' && resultSurface !== 'image')
        ) return null;
        try {
          const destination = new URL(libraryUrl);
          destination.pathname = '/app/library';
          destination.search = '';
          destination.searchParams.set('view', 'review');
          destination.searchParams.set('kind', resultSurface);
          destination.searchParams.set('job', jobId);
          return safeUrl(destination.toString());
        } catch {
          return null;
        }
      }

      function render(value) {
        const result = record(value);
        const media = record(result?.result);
        const workspace = record(result?.workspace);
        const library = record(result?.library);
        const download = record(result?.download);
        const isComplete = result?.status === 'completed';
        const libraryUrl = safeUrl(library?.url);
        const destination = buildResultLibraryUrl(libraryUrl, result?.jobId, result?.surface)
          || safeUrl(workspace?.url)
          || libraryUrl;
        const videoUrl = media?.surface === 'video' ? safeUrl(media.videoUrl) : null;
        const posterUrl = media?.surface === 'video' ? safeUrl(media.thumbnailUrl) : null;
        const imageUrl = media?.surface === 'image' && Array.isArray(media.imageUrls)
          ? safeUrl(media.imageUrls[0])
          : null;

        status.textContent = isComplete ? 'Completed' : String(result?.status || 'Ready');
        surface.textContent = result?.surface === 'image' ? 'Image' : 'Video';
        price.textContent = money(result?.priceCents, result?.currency);
        saved.textContent = result?.savedToLibrary
          ? 'Saved to your MaxVideoAI library'
          : 'Available in your connected MaxVideoAI account';
        openUrl = destination;
        openButton.disabled = !openUrl;
        downloadUrl = isComplete ? safeUrl(download?.url) : null;
        downloadName = typeof download?.filename === 'string' && download.filename.length <= 160
          ? download.filename
          : 'maxvideoai-generation';
        downloadExpiresAt = typeof download?.expiresAt === 'string' ? download.expiresAt : null;
        currentJobId = typeof result?.jobId === 'string' && result.jobId.length <= 256
          ? result.jobId
          : null;
        downloadButton.disabled = !isComplete || !currentJobId;

        video.pause();
        video.removeAttribute('src');
        video.removeAttribute('poster');
        image.removeAttribute('src');
        video.hidden = true;
        image.hidden = true;
        empty.hidden = true;

        if (isComplete && videoUrl) {
          video.src = videoUrl;
          if (posterUrl) video.poster = posterUrl;
          video.hidden = false;
          video.load();
        } else if (isComplete && imageUrl) {
          image.src = imageUrl;
          image.hidden = false;
        } else {
          empty.textContent = isComplete
            ? 'The result is saved in MaxVideoAI and can be opened from your library.'
            : 'This generation is not completed yet.';
          empty.hidden = false;
        }

        scheduleSizeChanged();
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

      function scheduleSizeChanged() {
        if (!initialized) return;
        requestAnimationFrame(() => {
          const html = document.documentElement;
          const originalHeight = html.style.height;
          html.style.height = 'max-content';
          const width = Math.ceil(window.innerWidth);
          const height = Math.ceil(html.getBoundingClientRect().height);
          html.style.height = originalHeight;
          if (width === lastWidth && height === lastHeight) return;
          lastWidth = width;
          lastHeight = height;
          notify('ui/notifications/size-changed', { width, height });
        });
      }

      function setupSizeChangedNotifications() {
        scheduleSizeChanged();
        if (!('ResizeObserver' in window)) return;
        const observer = new ResizeObserver(scheduleSizeChanged);
        observer.observe(document.documentElement);
        observer.observe(document.body);
      }

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
          render(record(message.params)?.structuredContent);
          return;
        }
        if (message.method === 'ui/resource-teardown' && message.id !== undefined) {
          video.pause();
          window.parent.postMessage({ jsonrpc: '2.0', id: message.id, result: {} }, '*');
        }
      }, { passive: true });

      async function connectMcpApp() {
        await request('ui/initialize', {
          appInfo: { name: 'MaxVideoAI generation result', version: '1.0.0' },
          appCapabilities: { availableDisplayModes: ['inline'] },
          protocolVersion: '2026-01-26',
        });
        notify('ui/notifications/initialized');
        initialized = true;
        setupSizeChangedNotifications();
      }

      openButton.addEventListener('click', async () => {
        if (!openUrl) return;
        if (window.openai?.openExternal) {
          await window.openai.openExternal({ href: openUrl, redirectUrl: false });
          return;
        }
        void request('ui/open-link', { url: openUrl });
      });

      function usableDownloadUrl() {
        if (!downloadUrl) return null;
        const expiresAt = Date.parse(downloadExpiresAt || '');
        return Number.isFinite(expiresAt) && expiresAt > Date.now() + 10_000
          ? downloadUrl
          : null;
      }

      function startDownload(url, filename) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.rel = 'noopener noreferrer';
        link.hidden = true;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }

      async function refreshDownload() {
        if (!currentJobId) return null;
        const result = await request('tools/call', {
          name: 'get_generation_download',
          arguments: { jobId: currentJobId },
        });
        const structured = record(record(result)?.structuredContent);
        const download = record(structured?.download);
        const freshUrl = safeUrl(download?.url);
        if (!freshUrl) return null;
        downloadUrl = freshUrl;
        downloadName = typeof download?.filename === 'string' && download.filename.length <= 160
          ? download.filename
          : downloadName;
        downloadExpiresAt = typeof download?.expiresAt === 'string' ? download.expiresAt : null;
        return freshUrl;
      }

      downloadButton.addEventListener('click', async () => {
        if (!currentJobId) return;
        downloadButton.disabled = true;
        const previousLabel = downloadButton.textContent;
        downloadButton.textContent = 'Preparing…';
        try {
          const freshUrl = await refreshDownload().catch(() => null);
          const url = freshUrl || usableDownloadUrl();
          if (url) startDownload(url, downloadName);
        } finally {
          downloadButton.textContent = previousLabel;
          downloadButton.disabled = false;
        }
      });

      if (window.openai?.toolOutput) render(window.openai.toolOutput);
      void connectMcpApp().catch(() => {
        initialized = false;
      });
    </script>
  </body>
</html>`;
}

export function registerGenerationResultApp(server: McpServer): void {
  const resourceDomains = generationResultAppResourceDomains();
  const redirectDomains = generationResultAppRedirectDomains();
  const resourceUris = [GENERATION_RESULT_APP_URI, ...LEGACY_GENERATION_RESULT_APP_URIS];
  for (const [index, resourceUri] of resourceUris.entries()) {
    server.registerResource(
      `maxvideoai-generation-result-${index + 1}`,
      resourceUri,
      {
        title: 'MaxVideoAI generation result',
        description: 'Inline player for one completed MaxVideoAI generation.',
        mimeType: 'text/html;profile=mcp-app',
        _meta: {
          ui: {
            prefersBorder: true,
            csp: { connectDomains: [], resourceDomains },
          },
        },
      },
      async () => ({
        contents: [{
          uri: resourceUri,
          mimeType: 'text/html;profile=mcp-app',
          text: buildGenerationResultAppHtml(),
          _meta: {
            ui: {
              prefersBorder: true,
              csp: { connectDomains: [], resourceDomains },
            },
            'openai/widgetDescription': 'A playable MaxVideoAI generation saved in the connected account.',
            'openai/widgetPrefersBorder': true,
            'openai/widgetCSP': {
              connect_domains: [],
              resource_domains: resourceDomains,
              redirect_domains: redirectDomains,
            },
          },
        }],
      }),
    );
  }
}
