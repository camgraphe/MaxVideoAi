import { check, digest, isHash, targetFingerprint, validateManifest, verifyImage, type Manifest, type Registration, type Target } from './manifest';

export type StoragePorts = {
  target(): Target;
  put(input: { key: string; data: Buffer; mime: string; acl: null; cacheControl: 'private, no-store'; conditionalCreate: true }): Promise<void>;
  read(key: string): Promise<{ data: Buffer; mime: string }>;
  sign(key: string, options: { method: 'GET'; expiresInSeconds: number }): Promise<string>;
  delete(key: string): Promise<void>;
};
type ObjectStatus = 'pending' | 'uncertain' | 'created' | 'preexisting' | 'collision' | 'deleted';
type JobStatus = 'not-submitted' | 'accepted' | 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'abandoned';
type Review = 'pending' | 'complete' | 'abandoned';
type GrantRecord = { referenceId: string; urlSha256: string; issuedAt: string; expiresAt: string };
export type Journal = {
  schemaVersion: 1; manifestSha256: string;
  objects: Record<string, { status: ObjectStatus }>;
  jobs: Record<string, { status: JobStatus; requestId?: string; review: Review; grants: GrantRecord[] }>;
};
export type Grant = { referenceId: string; method: 'GET'; key: string; url: string; issuedAt: string; expiresAt: string };
const terminal = (status: JobStatus) => ['succeeded', 'failed', 'cancelled', 'abandoned'].includes(status);
const objectStatuses = ['pending', 'uncertain', 'created', 'preexisting', 'collision', 'deleted'];
const jobStatuses = ['not-submitted', 'accepted', 'queued', 'running', 'succeeded', 'failed', 'cancelled', 'abandoned'];

function validateJournal(state: Journal, manifestSha256: string, manifest: Manifest) {
  check(state?.schemaVersion === 1 && state.manifestSha256 === manifestSha256
    && JSON.stringify(Object.keys(state.objects ?? {}).sort()) === JSON.stringify(manifest.references.map(x => x.id).sort())
    && JSON.stringify(Object.keys(state.jobs ?? {}).sort()) === JSON.stringify(manifest.dependencies.map(x => x.sceneId).sort()), 'JOURNAL');
  for (const ref of manifest.references) {
    const status = state.objects[ref.id]?.status;
    check(objectStatuses.includes(status) && (ref.disposition !== 'preexisting' || ['pending', 'preexisting'].includes(status))
      && (ref.disposition !== 'create' || status !== 'preexisting'), 'JOURNAL');
  }
  for (const dependency of manifest.dependencies) {
    const job = state.jobs[dependency.sceneId];
    check(job && jobStatuses.includes(job.status) && ['pending', 'complete', 'abandoned'].includes(job.review)
      && (job.review === 'pending' || terminal(job.status)) && Array.isArray(job.grants)
      && (['not-submitted', 'abandoned'].includes(job.status) ? !job.requestId : validRequestId(job.requestId)), 'JOURNAL');
    check(job.grants.length === 0 || (job.grants.length === dependency.referenceIds.length && job.grants.every((grant, i) =>
      grant?.referenceId === dependency.referenceIds[i] && isHash(grant.urlSha256)
      && Number.isFinite(Date.parse(grant.issuedAt)) && Date.parse(grant.expiresAt) > Date.parse(grant.issuedAt))), 'JOURNAL');
  }
}
function validRequestId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,200}$/.test(value);
}
function collision(error: unknown) {
  const e = error as { name?: string; context?: { code?: string }; $metadata?: { httpStatusCode?: number } };
  return e?.context?.code === 'precondition-conflict' || e?.name === 'PreconditionFailed' || e?.$metadata?.httpStatusCode === 412;
}

export async function openStagingBatch(input: {
  manifest: Manifest; registration: Registration; ports: StoragePorts; state?: Journal;
  save(state: Journal): Promise<void>; now?: () => Date;
}) {
  const { manifest, buffers, manifestSha256 } = await validateManifest(input.manifest, input.registration, input.ports.target());
  const state: Journal = input.state ? structuredClone(input.state) : {
    schemaVersion: 1, manifestSha256,
    objects: Object.fromEntries(manifest.references.map(ref => [ref.id, { status: 'pending' as const }])),
    jobs: Object.fromEntries(manifest.dependencies.map(x => [x.sceneId, { status: 'not-submitted' as const, review: 'pending' as const, grants: [] }])),
  };
  validateJournal(state, manifestSha256, manifest);
  const now = () => (input.now ?? (() => new Date()))().getTime();
  let busy = false;
  let journalBroken = false;
  function guard() {
    check(!journalBroken, 'JOURNAL');
    check(targetFingerprint(input.ports.target()) === manifest.targetFingerprintSha256, 'TARGET');
    check(Number.isFinite(now()), 'CLOCK');
  }
  async function persist() {
    try { await input.save(structuredClone(state)); }
    catch { journalBroken = true; throw new Error('LAUNCH_JOURNAL'); }
  }
  async function exclusive<T>(operation: () => Promise<T>): Promise<T> {
    check(!busy, 'BUSY'); busy = true;
    try { guard(); return await operation(); }
    finally { busy = false; }
  }
  function dependency(sceneId: string) {
    const value = manifest.dependencies.find(x => x.sceneId === sceneId);
    check(value, 'REFERENCES'); return value;
  }
  function checkPending(sceneId: string) {
    dependency(sceneId);
    check(state.jobs[sceneId].status === 'not-submitted', 'ALREADY_SUBMITTED');
  }

  return {
    summary() {
      const values = Object.values(state.objects).map(x => x.status);
      return { references: values.length, created: values.filter(x => x === 'created').length,
        preexisting: values.filter(x => x === 'preexisting').length, deleted: values.filter(x => x === 'deleted').length,
        held: values.filter(x => x === 'uncertain' || x === 'collision').length,
        jobsTerminal: Object.values(state.jobs).filter(x => terminal(x.status)).length };
    },
    async stage() {
      return exclusive(async () => {
        check(!Object.values(state.objects).some(x => ['uncertain', 'collision', 'deleted'].includes(x.status)), 'HELD');
        for (const ref of manifest.references) {
          if (state.objects[ref.id].status !== 'pending') continue;
          guard();
          if (ref.disposition === 'preexisting') {
            let read;
            try { read = await input.ports.read(ref.key); } catch { throw new Error('LAUNCH_READ'); }
            check(read.mime === ref.mime, 'BYTES');
            await verifyImage(read.data, ref);
            state.objects[ref.id].status = 'preexisting'; await persist(); continue;
          }
          // Persist uncertainty FIRST. A crash/lost response must never become a retry or cleanup claim.
          state.objects[ref.id].status = 'uncertain'; await persist(); guard();
          try {
            await input.ports.put({ key: ref.key, data: Buffer.from(buffers.get(ref.id)!), mime: ref.mime,
              acl: null, cacheControl: 'private, no-store', conditionalCreate: true });
          } catch (error) {
            const status = collision(error) ? 'collision' : 'uncertain';
            state.objects[ref.id].status = status; await persist();
            throw new Error(`LAUNCH_${status.toUpperCase()}`);
          }
          state.objects[ref.id].status = 'created'; await persist();
        }
      });
    },
    async issueGrants(sceneId: string, options: { expiresInSeconds: number; credentialsValidUntil: string }): Promise<Grant[]> {
      return exclusive(async () => {
        const refs = dependency(sceneId).referenceIds; checkPending(sceneId);
        const ttl = options.expiresInSeconds;
        check(Number.isSafeInteger(ttl) && ttl >= 1 && ttl <= 86400, 'TTL');
        check(Date.parse(options.credentialsValidUntil) >= now() + ttl * 1000, 'CREDENTIAL_LIFETIME');
        check(refs.every(id => ['created', 'preexisting'].includes(state.objects[id].status)), 'NOT_STAGED');
        const grants: Grant[] = [];
        for (const id of refs) {
          guard(); const ref = manifest.references.find(x => x.id === id)!;
          let url: string;
          try { url = await input.ports.sign(ref.key, { method: 'GET', expiresInSeconds: ttl }); }
          catch { throw new Error('LAUNCH_SIGN'); }
          const times = validateSignedUrl(url, ref.key, input.ports.target(), ttl, now());
          check(Date.parse(options.credentialsValidUntil) >= Date.parse(times.expiresAt), 'CREDENTIAL_LIFETIME');
          grants.push({ referenceId: id, method: 'GET', key: ref.key, url, ...times });
        }
        state.jobs[sceneId].grants = grants.map(g => ({ referenceId: g.referenceId, urlSha256: digest(g.url), issuedAt: g.issuedAt, expiresAt: g.expiresAt }));
        await persist(); return grants;
      });
    },
    assertGrants(sceneId: string, grants: Grant[], minimumRemainingSeconds = 60) {
      guard(); checkPending(sceneId);
      check(Number.isFinite(minimumRemainingSeconds) && minimumRemainingSeconds >= 0, 'GRANT');
      const refs = dependency(sceneId).referenceIds;
      check(Array.isArray(grants) && grants.length === refs.length, 'GRANT');
      for (let i = 0; i < refs.length; i++) {
        const grant = grants[i]; const record = state.jobs[sceneId].grants[i];
        const ref = manifest.references.find(x => x.id === refs[i])!;
        check(grant && record && typeof grant.url === 'string' && grant.referenceId === ref.id && grant.method === 'GET' && grant.key === ref.key
          && digest(grant.url) === record.urlSha256 && grant.issuedAt === record.issuedAt && grant.expiresAt === record.expiresAt
          && now() >= Date.parse(grant.issuedAt) && now() + minimumRemainingSeconds * 1000 < Date.parse(grant.expiresAt)
          && ['created', 'preexisting'].includes(state.objects[ref.id].status), 'GRANT');
      }
    },
    async recordJob(sceneId: string, event: { status: Exclude<JobStatus, 'not-submitted'>; requestId?: string; review?: Review }) {
      return exclusive(async () => {
        dependency(sceneId); const job = state.jobs[sceneId];
        check(jobStatuses.includes(event.status) && event.status !== ('not-submitted' as string), 'JOB_STATE');
        check(!terminal(job.status) || event.status === job.status, 'JOB_STATE');
        if (event.status === 'abandoned') check(job.status === 'not-submitted' || job.status === 'abandoned', 'JOB_STATE');
        else {
          check(validRequestId(event.requestId) && (!job.requestId || job.requestId === event.requestId), 'REQUEST_ID');
          check(job.status !== 'not-submitted' || (event.status === 'accepted'
            && (dependency(sceneId).referenceIds.length === 0 || job.grants.length > 0)), 'JOB_STATE');
          const rank = (status: JobStatus) => jobStatuses.indexOf(status);
          check(terminal(event.status) || rank(event.status) >= rank(job.status), 'JOB_STATE');
        }
        const review = event.review ?? job.review;
        check(['pending', 'complete', 'abandoned'].includes(review) && (review === 'pending' || terminal(event.status)), 'JOB_STATE');
        state.jobs[sceneId] = { ...job, status: event.status, review,
          ...(event.status !== 'abandoned' ? { requestId: event.requestId } : {}) };
        await persist();
      });
    },
    async cleanup() {
      return exclusive(async () => {
        check(Object.values(state.jobs).every(job => terminal(job.status) && job.review !== 'pending'), 'RETENTION');
        for (const ref of manifest.references) {
          if (state.objects[ref.id].status !== 'created') continue;
          guard();
          try { await input.ports.delete(ref.key); }
          catch (error) {
            const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
            if (e?.name !== 'NoSuchKey' && e?.$metadata?.httpStatusCode !== 404) throw new Error('LAUNCH_DELETE');
          }
          state.objects[ref.id].status = 'deleted'; await persist();
        }
      });
    },
  };
}

function validateSignedUrl(value: string, key: string, target: Target, ttl: number, now: number) {
  try {
    const url = new URL(value);
    const date = url.searchParams.get('X-Amz-Date') ?? '';
    check(/^\d{8}T\d{6}Z$/.test(date), 'GRANT');
    const issuedAt = new Date(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${date.slice(9, 11)}:${date.slice(11, 13)}:${date.slice(13, 15)}Z`).toISOString();
    const expiresAt = new Date(Date.parse(issuedAt) + ttl * 1000).toISOString();
    check(url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash
      && url.hostname === `${target.bucket}.s3.${target.region}.amazonaws.com` && url.pathname === `/${key}`
      && url.searchParams.getAll('X-Amz-Date').length === 1 && url.searchParams.getAll('X-Amz-Expires').length === 1
      && url.searchParams.get('X-Amz-Expires') === String(ttl) && url.searchParams.get('X-Amz-Signature')
      && Date.parse(issuedAt) <= now && now - Date.parse(issuedAt) < 60_000, 'GRANT');
    return { issuedAt, expiresAt };
  } catch { throw new Error('LAUNCH_GRANT'); }
}
