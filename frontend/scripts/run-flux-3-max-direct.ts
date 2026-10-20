import { createFalClient } from '@fal-ai/client';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, open, link, rm } from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import {
  prepareDirectQuote, submitDirectJob, recoverDirectJob, createSingleSubmissionFetch,
  readDirectPriceEvidence, assertDirectPricesUnchanged, type DirectQuote, type DirectPriceEvidence,
} from './_lib/flux-3-max-direct-runner';

function options(args: string[]) {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]; const value = args[i + 1];
    if (!/^--[a-z-]+$/.test(key) || !value || value.startsWith('--') || result[key] !== undefined) throw new Error('INVALID_ARGUMENTS');
    result[key] = value;
  }
  return result;
}
function required(flags: Record<string, string>, key: string): string {
  if (!flags[key]) throw new Error('REQUIRED_' + key.slice(2).replaceAll('-', '_').toUpperCase());
  return flags[key];
}
async function json(file: string): Promise<unknown> { return JSON.parse(await readFile(file, 'utf8')); }
async function save(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await writeFile(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
}
async function credential(flags: Record<string, string>): Promise<string> {
  const file = required(flags, '--credentials-env');
  if (!path.isAbsolute(file)) throw new Error('CREDENTIAL_FILE_MUST_BE_ABSOLUTE');
  // Parse only the explicitly selected file. Do not load DB, auth, storage or inherited env.
  const env = dotenv.parse(await readFile(file));
  const key = env.FAL_API_KEY || env.FAL_KEY;
  if (!key?.trim()) throw new Error('FAL_KEY_UNAVAILABLE');
  return key.trim();
}
async function collectVideo(response: { requestId: string; endpoint: string; status: string; result?: unknown }, output: string) {
  if (response.status !== 'COMPLETED') throw new Error('RESULT_NOT_COMPLETED');
  const result = response.result as { data?: { video?: { url?: string } }; requestId?: string };
  if (result.requestId && result.requestId !== response.requestId) throw new Error('RESULT_ID_MISMATCH');
  const url = new URL(result.data?.video?.url ?? '');
  if (url.protocol !== 'https:' || !(url.hostname === 'fal.media' || url.hostname.endsWith('.fal.media')) || url.username || url.password) throw new Error('RESULT_CDN_UNVERIFIED');
  const download = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(120_000) });
  if (!download.ok || !download.body || !download.headers.get('content-type')?.startsWith('video/')) throw new Error('RESULT_DOWNLOAD_FAILED');
  const maxBytes = 150 * 1024 * 1024;
  if (Number(download.headers.get('content-length') ?? 0) > maxBytes) throw new Error('RESULT_TOO_LARGE');
  const temporary = output + '.partial';
  await mkdir(path.dirname(output), { recursive: true, mode: 0o700 });
  const reserve = await open(output + '.lock', 'wx', 0o600); await reserve.close();
  const file = await open(temporary, 'wx', 0o600);
  const hash = createHash('sha256'); let bytes = 0;
  try {
    const reader = download.body.getReader();
    for (;;) {
      const { value: chunk, done } = await reader.read();
      if (done) break;
      bytes += chunk.byteLength;
      if (bytes > maxBytes) throw new Error('RESULT_TOO_LARGE');
      hash.update(chunk); await file.writeFile(chunk);
    }
    await file.sync(); await file.close();
    await link(temporary, output); await rm(temporary);
    await save(output + '.provenance.json', { provenance: 'external-fal-generation', engineId: 'flux-3-max',
      endpoint: response.endpoint, providerRequestId: response.requestId, originalProviderUrl: url.toString(),
      collectedAt: new Date().toISOString(), sha256: hash.digest('hex'), sizeBytes: bytes,
      appJobId: null, maxVideoAiWalletCharge: null, localVideoPath: path.resolve(output), providerResult: result });
    return { videoPath: path.resolve(output), sizeBytes: bytes, provenancePath: path.resolve(output + '.provenance.json') };
  } catch (error) {
    await file.close().catch(() => undefined); await rm(temporary, { force: true }); throw error;
  }
}
async function main() {
  const [command = 'help', ...args] = process.argv.slice(2); const flags = options(args);
  const allowed: Record<string, string[]> = {
    quote: ['--manifest', '--output'], prices: ['--credentials-env', '--output'],
    submit: ['--quote', '--id', '--state-dir', '--approve-quote', '--max-provider-usd', '--credentials-env', '--price-evidence'],
    recover: ['--id', '--state-dir', '--credentials-env', '--output'],
    collect: ['--id', '--state-dir', '--credentials-env', '--output'],
  };
  if (!allowed[command]) {
    console.log('Commands: quote (offline), prices (GET only), submit (explicit approved hash/cap), recover (GET only), collect (download). No batch submit or automatic retry.');
    return;
  }
  if (Object.keys(flags).some(key => !allowed[command].includes(key))) throw new Error('UNKNOWN_ARGUMENT');
  if (command === 'quote') {
    const quote = await prepareDirectQuote(await json(required(flags, '--manifest')));
    await save(required(flags, '--output'), quote);
    console.log(JSON.stringify({ quoteSha256: quote.quoteSha256, jobs: quote.jobs.map(({ id, mode, durationSec, resolution, providerEstimateUsd }) => ({ id, mode, durationSec, resolution, providerEstimateUsd })),
      providerEstimateUsd: quote.providerEstimateUsd, providerListUsdNotApproved: quote.providerListUsd, expiresAt: quote.expiresAt, billing: quote.billing }, null, 2)); return;
  }
  const key = await credential(flags);
  if (command === 'prices') {
    const evidence = await readDirectPriceEvidence(key); await save(required(flags, '--output'), evidence);
    console.log(JSON.stringify(evidence, null, 2)); return;
  }
  const client = createFalClient({ credentials: key, retry: { maxRetries: 0 }, fetch: createSingleSubmissionFetch() });
  const stateDir = required(flags, '--state-dir'); const jobId = required(flags, '--id');
  if (command === 'submit') {
    const quote = await json(required(flags, '--quote')) as DirectQuote;
    const evidence = await json(required(flags, '--price-evidence')) as DirectPriceEvidence;
    const current = await readDirectPriceEvidence(key);
    assertDirectPricesUnchanged(quote, evidence, current);
    const result = await submitDirectJob({ quote, jobId, stateDir, approvedQuoteSha256: required(flags, '--approve-quote'), maxProviderUsd: Number(required(flags, '--max-provider-usd')) }, {
      upload: (bytes, filename) => client.storage.upload(new File([new Uint8Array(bytes)], filename, { type: /\.png$/i.test(filename) ? 'image/png' : /\.webp$/i.test(filename) ? 'image/webp' : 'image/jpeg' })),
      submit: (endpoint, input) => client.queue.submit(endpoint, { input }),
    });
    await save(path.join(stateDir, jobId + '.prices.json'), current);
    console.log(JSON.stringify(result)); return;
  }
  const result = await recoverDirectJob({ stateDir, jobId }, {
    status: (endpoint, requestId) => client.queue.status(endpoint, { requestId, logs: false }),
    result: (endpoint, requestId) => client.queue.result(endpoint, { requestId }),
  });
  if (command === 'collect') console.log(JSON.stringify(await collectVideo(result, required(flags, '--output'))));
  else { if (flags['--output']) await save(flags['--output'], result); console.log(JSON.stringify({ requestId: result.requestId, status: result.status, endpoint: result.endpoint })); }
}
void main().catch((error: unknown) => {
  // Never print raw SDK errors, response bodies, credentials or environment values.
  const message = error instanceof Error && /^[A-Z][A-Z0-9_-]+$/.test(error.message) ? error.message : 'OPERATION_FAILED_INSPECT_LOCAL_STATE_NO_RESUBMISSION';
  console.error('[flux-3-max-direct] ' + message); process.exitCode = 1;
});
