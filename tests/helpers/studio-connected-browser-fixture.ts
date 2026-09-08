import assert from 'node:assert/strict';
import {
  chromium,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
  type Route,
} from '@playwright/test';
import {
  STUDIO_PRIVATE_MEDIA_HOST,
  serveStudioPrivateMediaRequest,
} from './studio-private-storage-fixture';

type AuthCookie = { name: string; value: string };
type BrowserContextFixtureOptions = Pick<
  BrowserContextOptions,
  'colorScheme' | 'locale' | 'reducedMotion' | 'viewport'
>;

export type StudioPrivateBrowserRequest = Readonly<{
  method: string;
  range: string | null;
  status: number;
  /** Query deliberately omitted so bearer-style object signatures never enter the journal. */
  url: string;
}>;

export type OwnedStudioBrowserContext = Readonly<{
  context: BrowserContext;
  page: Page;
  close(): Promise<void>;
}>;

type StudioBrowserRuntime<Session> = {
  origin: string;
  browserOrigin: string;
  auth: {
    origin: string;
    cookiesFor(session: Session): AuthCookie[];
  };
};

function exactOrigin(value: string): URL {
  const parsed = new URL(value);
  assert.ok(
    value === parsed.origin || value === `${parsed.origin}/`,
    'Browser fixture origins must not include credentials, paths, query or fragments.',
  );
  return parsed;
}

async function handleRequest(
  route: Route,
  allowedOrigins: ReadonlySet<string>,
  privateRequests: StudioPrivateBrowserRequest[],
  signatureClock: () => Date,
): Promise<void> {
  const request = route.request();
  const url = new URL(request.url());
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    await route.continue();
    return;
  }

  if (url.protocol === 'https:' && url.host === STUDIO_PRIVATE_MEDIA_HOST) {
    const range = request.headers()['range'] ?? null;
    const response = await serveStudioPrivateMediaRequest({
      url: request.url(),
      method: request.method(),
      range,
      now: signatureClock(),
    });
    privateRequests.push(Object.freeze({
      method: request.method(),
      range,
      status: response.status,
      url: `${url.origin}${url.pathname}`,
    }));
    await route.fulfill({ status: response.status, headers: response.headers, body: response.body });
    return;
  }

  if (allowedOrigins.has(url.origin)) {
    await route.continue();
    return;
  }
  await route.abort('blockedbyclient');
}

/** Owns one non-persistent Chromium process and every fresh session context it creates. */
export async function startStudioConnectedBrowserFixture<Session>(options: {
  runtime: StudioBrowserRuntime<Session>;
  signatureClock?: () => Date;
  headless?: boolean;
}) {
  assert.equal(process.versions.node.split('.')[0], '22', 'Use the project Node 22 runtime.');
  const app = exactOrigin(options.runtime.browserOrigin);
  const appIpv4 = exactOrigin(options.runtime.origin);
  const auth = exactOrigin(options.runtime.auth.origin);
  assert.equal(app.protocol, 'http:');
  assert.equal(app.hostname, 'localhost');
  assert.equal(appIpv4.protocol, 'http:');
  assert.equal(appIpv4.hostname, '127.0.0.1');
  assert.equal(app.port, appIpv4.port, 'Browser and IPv4 origins must identify the same owned app child.');
  assert.equal(auth.protocol, 'http:');
  assert.equal(auth.hostname, '127.0.0.1');

  const allowedOrigins = new Set([app.origin, appIpv4.origin, auth.origin]);
  const privateRequests: StudioPrivateBrowserRequest[] = [];
  const signatureClock = options.signatureClock ?? (() => new Date());
  const browser = await chromium.launch({
    headless: options.headless ?? true,
    args: [
      '--disable-background-networking',
      '--host-resolver-rules=MAP localhost 127.0.0.1',
    ],
  });
  const contexts = new Set<BrowserContext>();
  let closing: Promise<void> | null = null;

  async function newContext(
    session: Session,
    contextOptions: BrowserContextFixtureOptions = {},
  ): Promise<OwnedStudioBrowserContext> {
    assert.equal(closing, null, 'Cannot create a context after browser fixture close started.');
    const context = await browser.newContext({
      ...contextOptions,
      baseURL: app.origin,
      serviceWorkers: 'block',
    });
    contexts.add(context);
    context.once('close', () => contexts.delete(context));
    try {
      const cookies = options.runtime.auth.cookiesFor(session);
      assert.ok(cookies.length > 0, 'Authenticated browser context requires fixture cookies.');
      await context.addCookies(cookies.map(({ name, value }) => ({ name, value, url: app.origin })));
      await context.route('**/*', (route) => handleRequest(
        route,
        allowedOrigins,
        privateRequests,
        signatureClock,
      ));
      const page = await context.newPage();
      let contextClosing: Promise<void> | null = null;
      return Object.freeze({
        context,
        page,
        close() {
          contextClosing ??= context.close();
          return contextClosing;
        },
      });
    } catch (error) {
      await context.close().catch(() => undefined);
      throw error;
    }
  }

  async function close(): Promise<void> {
    closing ??= (async () => {
      try {
        await Promise.all([...contexts].map((context) => context.close()));
      } finally {
        await browser.close();
      }
    })();
    return closing;
  }

  return Object.freeze({
    browser: browser as Browser,
    newContext,
    readPrivateRequests: () => privateRequests.map((entry) => ({ ...entry })),
    close,
  });
}
