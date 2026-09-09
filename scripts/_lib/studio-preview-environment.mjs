import path from 'node:path';

export function parseStudioPreviewPort(args) {
  if (args.some((arg) => !/^--port=\d+$/.test(arg)) || args.length > 1) {
    throw new Error('Usage: node scripts/studio-local-preview.mjs [--port=3032]');
  }
  const port = Number(args[0]?.split('=')[1] ?? 3032);
  if (!Number.isInteger(port) || port < 1024 || port > 65533 || port === 3026 || port === 3025) {
    throw new Error('Choose a local port from 1024 to 65533, keeping both it and the auth port away from 3026.');
  }
  return port;
}

export function createStudioPreviewEnvironment({ port, executable, inherited }) {
  return {
    PATH: `${path.dirname(executable)}:${inherited.PATH ?? '/usr/bin:/bin'}`,
    ...(inherited.HOME ? { HOME: inherited.HOME } : {}),
    ...(inherited.TMPDIR ? { TMPDIR: inherited.TMPDIR } : {}),
    NODE_ENV: 'development',
    NEXT_TELEMETRY_DISABLED: '1',
    NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${port + 1}`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'studio-local-anonymous-preview',
    NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${port}`,
    SITE_URL: `http://127.0.0.1:${port}`,
    NEXT_PUBLIC_VISITOR_WORKSPACE_ACCESS: 'true',
    NEXT_PUBLIC_ENV_LABEL: 'Local Studio preview',
  };
}
