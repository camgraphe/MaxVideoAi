import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { KlingV4ExternalFalImport } from './kling-v4';
import { canonicalImportJson, importDigest } from './contract';
import { privateSourceTargetFingerprint, readPrivateStagingReference, verifyPrivateSourceGrant,
  type BoundPrivateReference, type PrivateSourcePorts, type PrivateSourceTarget } from './private-staging-source';

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const proof = z.object({ path: z.string().min(1), sha256: hash }).strict();
const fileNames = ['journal', 'request', 'submissionStarted', 'accepted', 'acceptedResponse', 'status', 'result',
  'validation', 'grants', 'stagingRegistry', 'stagingManifest', 'stagingState'] as const;
const sourcesSchema = z.object(Object.fromEntries(fileNames.map(name => [name, proof])) as Record<typeof fileNames[number], typeof proof>).strict();
const bundleSchema = z.object({ schemaVersion: z.literal(1), profile: z.literal('nine01-native-v1'), ownerUserId: z.string().uuid(),
  operationId: z.string().regex(/^(NINE-01-FAL-0[1-9]-BASE|NINE-01-FAL-OPTION-01)$/), sceneId: z.string(), files: sourcesSchema }).strict();
const scenes = ['K4-JANITOR-US', 'K4-CONCERT', 'K4-NEXT-ONE', 'C04', 'C05', 'C06', 'C07', 'C08', 'C09'];
const bankOptionDependency = 'K4-JANITOR-US-OPTION-01';
const sha = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
const fail = (code: string): never => { throw new Error('IMPORT_NINE01_' + code); };
function check(value: unknown, code: string): asserts value { if (!value) fail(code); }
function object(value: unknown): Record<string, unknown> {
  check(value && typeof value === 'object' && !Array.isArray(value), 'SOURCE_SHAPE');
  return value as Record<string, unknown>;
}
const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable((value as Record<string, unknown>)[key])])) : value;
export function parsePrivateNativeJson(bytes: Buffer): unknown {
  try { return JSON.parse(bytes.toString('utf8')); } catch { return fail('SOURCE_JSON'); }
}

export type Nine01Identity = Pick<KlingV4ExternalFalImport, 'ownerUserId' | 'engineId' | 'mode' | 'endpoint'
  | 'providerRequestId' | 'providerInput' | 'videoSha256' | 'evidenceSha256'> & {
  references: Array<Pick<KlingV4ExternalFalImport['references'][number], 'slotId' | 'kind' | 'providerUrl' | 'sha256'>>;
};
export type NativeSourceEvidence = { profile: 'nine01-native-v1'; bundleSha256: string; journalSha256: string;
  journalHeadSha256: string; operationId: string; sceneId: string; dependencyId: string; candidateRole: 'base' | 'bank-option-01'; eventSequences: number[];
  sourceFiles: { role: string; sha256: string }[]; stagingManifestSha256: string; targetFingerprintSha256: string;
  references: { slotId: string; sourceSha256: string; objectKeySha256: string; historicalUrlSha256: string; nativeImageReceiptSha256: string }[] };

/** Read-only private operator source. No symlink leaf, Git/OUTREACH source, foreign/public file or unbounded allocation. */
export async function readPrivateNativeFile(filename: string, max = 20 * 1024 * 1024): Promise<Buffer> {
  let handle;
  try {
    check(path.isAbsolute(filename) && !filename.split('/').includes('..'), 'PRIVATE_FILE');
    const parent = await realpath(path.dirname(filename));
    check(!parent.split('/').some(part => part.toLowerCase() === 'outreach'), 'PRIVATE_FILE');
    const parentStat = await lstat(parent);
    check(parentStat.isDirectory() && (parentStat.mode & 0o077) === 0 && parentStat.uid === process.getuid?.(), 'PRIVATE_FILE');
    for (let directory = parent; ; directory = path.dirname(directory)) {
      try { await lstat(path.join(directory, '.git')); fail('PRIVATE_FILE'); }
      catch (error) { check((error as NodeJS.ErrnoException).code === 'ENOENT', 'PRIVATE_FILE'); }
      if (directory === path.dirname(directory)) break;
    }
    const resolved = path.join(parent, path.basename(filename));
    const stat = await lstat(resolved);
    check(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && (stat.mode & 0o077) === 0
      && stat.uid === process.getuid?.() && stat.size > 0 && stat.size <= max, 'PRIVATE_FILE');
    handle = await open(resolved, constants.O_RDONLY | constants.O_NOFOLLOW);
    const opened = await handle.stat();
    check(opened.ino === stat.ino && opened.dev === stat.dev && opened.size === stat.size, 'PRIVATE_FILE');
    const bytes = Buffer.alloc(stat.size + 1);
    let size = 0;
    while (size < bytes.length) {
      const part = await handle.read(bytes, size, bytes.length - size, size);
      if (!part.bytesRead) break;
      size += part.bytesRead;
    }
    check(size === stat.size, 'PRIVATE_FILE');
    return bytes.subarray(0, size);
  } catch { return fail('PRIVATE_FILE'); }
  finally { await handle?.close(); }
}

/** Source-only identity validation also works before any owned upload IDs exist. Never creates a receipt or rewrites events. */
export async function loadNine01NativeEvidence(identity: Nine01Identity, bytes: Buffer, targetValue: PrivateSourceTarget) {
  const input = structuredClone(identity), target = { ...targetValue };
  check(bytes.length <= 1024 * 1024 && sha(bytes) === input.evidenceSha256, 'BUNDLE_HASH');
  const parsed = bundleSchema.safeParse(parsePrivateNativeJson(bytes));
  if (!parsed.success) return fail('BUNDLE_SCHEMA');
  const bundle = parsed.data;
  check(input.engineId === 'kling-v4' && input.mode === 'ref2v' && input.endpoint === 'kling/v4/reference-to-video'
    && input.providerInput.resolution === '720p' && input.providerInput.aspect_ratio === '16:9'
    && !input.providerInput.video_urls?.length && !input.providerInput.elements?.length && !input.providerInput.start_image_url
    && bundle.ownerUserId === input.ownerUserId, 'OWNER_OR_SCOPE');
  const optional = bundle.operationId === 'NINE-01-FAL-OPTION-01';
  const canonicalSceneId = optional ? scenes[0] : scenes[Number(bundle.operationId.slice(12, 14)) - 1];
  check((optional ? bankOptionDependency : canonicalSceneId) === bundle.sceneId, 'OPERATION_SCENE');
  const fileBytes = {} as Record<typeof fileNames[number], Buffer>;
  const data = {} as Record<typeof fileNames[number], Record<string, unknown>>;
  for (const name of fileNames) {
    fileBytes[name] = await readPrivateNativeFile(bundle.files[name].path);
    check(sha(fileBytes[name]) === bundle.files[name].sha256, 'SOURCE_HASH_' + name);
    if (name !== 'journal') data[name] = object(parsePrivateNativeJson(fileBytes[name]));
  }
  const events = fileBytes.journal.toString('utf8').trim().split('\n').map(line => object(parsePrivateNativeJson(Buffer.from(line))));
  let previous: string | null = null;
  for (let index = 0; index < events.length; index++) {
    const { eventSha256, ...body } = events[index];
    check(body.sequence === index + 1 && body.previousEventSha256 === previous && sha(JSON.stringify(stable(body))) === eventSha256, 'JOURNAL_CHAIN');
    previous = eventSha256 as string;
  }
  const selected = events.filter(row => row.operationId === bundle.operationId);
  const one = (event: string) => {
    const matches = selected.filter(row => row.event === event);
    check(matches.length === 1, 'EVENT_' + event);
    return matches[0];
  };
  const start = one('submission_started'), acceptedEvent = one('fal_request_accepted');
  const responseEvent = one('fal_submission_response_saved'), resultEvent = one('fal_result_validated');
  check(start.kind === 'fal' && start.state === 'submission_started'
    && Number(start.sequence) < Number(responseEvent.sequence) && Number(responseEvent.sequence) < Number(acceptedEvent.sequence)
    && Number(acceptedEvent.sequence) < Number(resultEvent.sequence), 'EVENT_ORDER');
  const endpointSha256 = sha('https://queue.fal.run/' + input.endpoint);
  const requestSha256 = bundle.files.request.sha256;
  check(canonicalImportJson(data.request) === canonicalImportJson(input.providerInput)
    && data.submissionStarted.operationId === bundle.operationId && data.submissionStarted.kind === 'fal'
    && data.submissionStarted.state === 'submission_started' && data.submissionStarted.requestBodySha256 === requestSha256
    && start.requestBodySha256 === requestSha256 && start.endpointSha256 === endpointSha256
    && data.submissionStarted.endpointSha256 === endpointSha256 && data.submissionStarted.atUtc === start.atUtc, 'REQUEST');
  const at = Date.parse(String(start.atUtc));
  const accepted = data.accepted, response = data.acceptedResponse;
  const resultUrl = `https://queue.fal.run/kling/v4/requests/${input.providerRequestId}`;
  const statusUrl = resultUrl + '/status';
  check(accepted.operationId === bundle.operationId && accepted.sceneId === bundle.sceneId && accepted.requestId === input.providerRequestId
    && accepted.requestPath === bundle.files.request.path && accepted.grantOutputPath === bundle.files.grants.path
    && accepted.requestBodySha256 === requestSha256 && accepted.providerResponseSha256 === bundle.files.acceptedResponse.sha256
    && Number.isFinite(at) && Date.parse(String(accepted.acceptedAtUtc)) >= at
    && accepted.statusUrl === statusUrl && accepted.resultUrl === resultUrl
    && response.request_id === input.providerRequestId && response.response_url === resultUrl && response.status_url === statusUrl
    && response.cancel_url === resultUrl + '/cancel'
    && responseEvent.httpStatus === 200 && responseEvent.responseSha256 === bundle.files.acceptedResponse.sha256
    && acceptedEvent.requestId === input.providerRequestId && acceptedEvent.resultUrlSha256 === sha(resultUrl)
    && acceptedEvent.statusUrlSha256 === sha(statusUrl) && acceptedEvent.requestedSeconds === input.providerInput.duration, 'ACCEPTANCE');
  const completed = selected.filter(row => row.event === 'fal_status_observed' && row.nativeStatus === 'COMPLETED' && row.httpStatus === 200);
  check(completed.length >= 1 && completed.every(row => Number(row.sequence) > Number(acceptedEvent.sequence))
    && data.status.status === 'COMPLETED' && data.status.request_id === input.providerRequestId
    && (data.status.response_url == null || data.status.response_url === resultUrl), 'COMPLETION');
  const validation = data.validation, measured = object(validation.measured);
  check(validation.schemaVersion === 1 && validation.operationId === bundle.operationId && validation.sceneId === canonicalSceneId
    && (!optional || validation.dependencyId === bundle.sceneId && validation.attemptKind === 'optional')
    && validation.providerRequestId === input.providerRequestId && validation.requestBodySha256 === requestSha256
    && validation.nativeResultSha256 === bundle.files.result.sha256 && validation.requestedSeconds === input.providerInput.duration
    && measured.sha256 === input.videoSha256 && resultEvent.masterSha256 === input.videoSha256, 'RESULT');
  const registry = data.stagingRegistry, registration = object(registry.registration), manifest = data.stagingManifest;
  const fingerprint = privateSourceTargetFingerprint(target);
  check(registry.schemaVersion === 1 && registry.manifestPath === bundle.files.stagingManifest.path && registry.statePath === bundle.files.stagingState.path
    && registration.account === 'Camgraph' && registration.ownerId === input.ownerUserId && manifest.ownerId === input.ownerUserId
    && manifest.schemaVersion === 1 && manifest.batchId === 'nine-01' && registration.batchId === manifest.batchId
    && typeof manifest.ownerToken === 'string' && /^[a-f0-9]{32}$/.test(manifest.ownerToken) && registration.ownerToken === manifest.ownerToken
    && registration.targetFingerprintSha256 === fingerprint && manifest.targetFingerprintSha256 === fingerprint
    && registration.manifestSha256 === sha(JSON.stringify(manifest)) && registration.referenceCount === 14
    && (registration.dependencyCount === 9 || registration.dependencyCount === 10), 'STAGING_REGISTRATION');
  check(Array.isArray(manifest.references) && manifest.references.length === 14 && Array.isArray(manifest.dependencies)
    && manifest.dependencies.length === registration.dependencyCount, 'STAGING_COUNTS');
  const manifestReferences = manifest.references.map(object), dependencies = manifest.dependencies.map(object);
  check(new Set(manifestReferences.map(ref => ref.id)).size === 14
    && new Set(dependencies.map(dep => dep.sceneId)).size === dependencies.length
    && scenes.every(sceneId => dependencies.some(dep => dep.sceneId === sceneId))
    && dependencies.every(dep => scenes.includes(String(dep.sceneId)) || dep.sceneId === bankOptionDependency), 'STAGING_IDENTITIES');
  const dependency = dependencies.find(dep => dep.sceneId === bundle.sceneId)!;
  check(dependency, 'STAGING_DEPENDENCY');
  const state = data.stagingState, jobs = object(state.jobs), job = object(jobs[bundle.sceneId]), objects = object(state.objects);
  check(state.schemaVersion === 1 && state.manifestSha256 === registration.manifestSha256 && job.status === 'succeeded'
    && job.requestId === input.providerRequestId && Array.isArray(job.grants) && Array.isArray(dependency.referenceIds)
    && data.grants.sceneId === bundle.sceneId && Array.isArray(data.grants.grants), 'STAGING_STATE');
  const grants = data.grants.grants.map(object), savedGrants = job.grants.map(object);
  check(grants.length >= 1 && grants.length <= 2 && grants.length === dependency.referenceIds.length
    && grants.length === input.references.length && grants.length === savedGrants.length
    && grants.length === input.providerInput.image_urls?.length, 'REFERENCE_ORDER');
  const bound: BoundPrivateReference[] = [];
  const nativeImageReceipts: string[] = [];
  for (let index = 0; index < grants.length; index++) {
    const grant = grants[index], saved = savedGrants[index], ref = input.references[index];
    const original = manifestReferences.find(item => item.id === grant.referenceId);
    check(original && typeof original.id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/.test(original.id)
      && typeof original.sha256 === 'string' && /^[a-f0-9]{64}$/.test(original.sha256), 'REFERENCE_ID');
    const extension = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as Record<string, string>)[String(original.mime)];
    const key = `editorial/drafts/launch-media/nine-01/${manifest.ownerToken}/${original.id}-${original.sha256}.${extension}`;
    check(extension && original.key === key && grant.key === key && grant.method === 'GET'
      && grant.referenceId === dependency.referenceIds[index] && saved.referenceId === grant.referenceId
      && saved.urlSha256 === sha(String(grant.url)) && saved.issuedAt === grant.issuedAt && saved.expiresAt === grant.expiresAt
      && ref.slotId === `image_urls.${index}` && ref.kind === 'image' && ref.providerUrl === grant.url
      && input.providerInput.image_urls?.[index] === grant.url && ref.sha256 === original.sha256
      && ['created', 'preexisting'].includes(String(object(objects[String(original.id)]).status)), 'REFERENCE_BINDING');
    verifyPrivateSourceGrant(String(grant.url), key, target, at, { issuedAt: String(grant.issuedAt), expiresAt: String(grant.expiresAt) });
    check(Number.isSafeInteger(original.size) && Number(original.size) > 0 && Number(original.size) <= 20 * 1024 * 1024, 'REFERENCE_SIZE');
    check(typeof original.sourcePath === 'string', 'REFERENCE_MASTER');
    const master = await readPrivateNativeFile(original.sourcePath);
    check(master.length === Number(original.size) && sha(master) === original.sha256, 'REFERENCE_MASTER_HASH');
    const provenance = object(original.provenance);
    check(provenance.provider === 'vertex' && provenance.model === 'gemini-nano-banana-2.1'
      && typeof provenance.nativeResponsePath === 'string' && typeof provenance.nativeResponseSha256 === 'string'
      && /^[a-f0-9]{64}$/.test(provenance.nativeResponseSha256) && typeof provenance.promptSha256 === 'string'
      && /^[a-f0-9]{64}$/.test(provenance.promptSha256), 'REFERENCE_PROVENANCE');
    check(sha(await readPrivateNativeFile(provenance.nativeResponsePath)) === provenance.nativeResponseSha256, 'REFERENCE_PROVENANCE_HASH');
    nativeImageReceipts.push(provenance.nativeResponseSha256);
    bound.push({ slotId: ref.slotId, key, sha256: ref.sha256, size: Number(original.size), mime: String(original.mime) });
  }
  const summary: NativeSourceEvidence = { profile: 'nine01-native-v1', bundleSha256: sha(bytes), journalSha256: bundle.files.journal.sha256,
    journalHeadSha256: previous!, operationId: bundle.operationId, sceneId: canonicalSceneId, dependencyId: bundle.sceneId,
    candidateRole: optional ? 'bank-option-01' : 'base',
    eventSequences: selected.map(row => Number(row.sequence)), sourceFiles: fileNames.map(role => ({ role, sha256: bundle.files[role].sha256 })),
    stagingManifestSha256: String(registration.manifestSha256), targetFingerprintSha256: fingerprint,
    references: bound.map((ref, index) => ({ slotId: ref.slotId, sourceSha256: ref.sha256, objectKeySha256: sha(ref.key),
      historicalUrlSha256: sha(input.references[index].providerUrl), nativeImageReceiptSha256: nativeImageReceipts[index] })) };
  return { resultDataSha256: importDigest(data.result), summary,
    async readReference(reference: Nine01Identity['references'][number], ports: PrivateSourcePorts, fetcher: typeof fetch) {
      check(privateSourceTargetFingerprint(ports.target) === fingerprint, 'TARGET_CHANGED');
      const index = input.references.findIndex(ref => ref.slotId === reference.slotId && ref.providerUrl === reference.providerUrl && ref.sha256 === reference.sha256);
      check(index >= 0, 'REFERENCE_BINDING');
      return readPrivateStagingReference(bound[index], ports, fetcher);
    } };
}
