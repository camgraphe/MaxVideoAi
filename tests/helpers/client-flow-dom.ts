import { build } from 'esbuild';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';

// Real browser owners are bundled together; only external adapters are replaced.
export async function bundleClientFlow(contents: string, boundaries: Record<string, string>) {
  const frontend = resolve('frontend');
  const result = await build({
    stdin: { contents, loader: 'tsx', resolveDir: frontend },
    absWorkingDir: frontend, bundle: true, platform: 'browser', format: 'iife', write: false,
    jsx: 'automatic', tsconfig: resolve(frontend, 'tsconfig.json'), loader: { '.css': 'empty', '.module.css': 'empty' },
    define: { 'process.env.NODE_ENV': '"test"' }, logLevel: 'silent',
    plugins: [{ name: 'controlled-external-boundaries', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => args.path in boundaries ? { path: args.path, namespace: 'fixture' } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: boundaries[args.path], loader: 'tsx', resolveDir: frontend }));
    } }],
  });
  return result.outputFiles[0].text;
}

export function createClientFlowDom(path: string) {
  const dom = new JSDOM('<div id="root"></div>', { url: `https://example.invalid${path}`, pretendToBeVisual: true, runScripts: 'dangerously' });
  const w = dom.window;
  Object.assign(w, { Headers, process: { env: {} }, MessageChannel: class {
    port1 = { onmessage() {} };
    port2 = { postMessage: () => setTimeout(() => this.port1.onmessage(), 0) };
  } });
  return dom;
}
