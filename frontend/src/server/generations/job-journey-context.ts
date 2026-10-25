import { requireGenerationActor, type GenerationActor } from '@/server/agent-api/generation-actor';

/** A reservation boundary fact, never an acquisition or browser attribution. */
export type JobJourneyContext = Readonly<{
  entrySurface: 'generator' | 'tool' | 'studio' | 'mcp' | 'unknown';
  entrySource: 'web_route' | 'confirmed_actor' | 'unknown';
  journeyVersion: 1;
  entryReleaseSha: string | null;
}>;
export type JobJourneyEnv = Pick<NodeJS.ProcessEnv, 'VERCEL_GIT_COMMIT_SHA'>;

const RELEASE_SHA = /^[0-9a-f]{40}$/;

function serverRelease(env: JobJourneyEnv): string | null {
  const sha = env.VERCEL_GIT_COMMIT_SHA;
  return typeof sha === 'string' && RELEASE_SHA.test(sha) ? sha : null;
}

export function buildWebJobJourneyContext(env: JobJourneyEnv = process.env): JobJourneyContext {
  return Object.freeze({ entrySurface: 'generator', entrySource: 'web_route', journeyVersion: 1,
    entryReleaseSha: serverRelease(env) });
}

export function buildConfirmedJobJourneyContext(actor: GenerationActor, env: JobJourneyEnv = process.env): JobJourneyContext {
  requireGenerationActor(actor);
  const entrySurface = actor.authMethod === 'studio-session' ? 'studio'
    : actor.authMethod === 'toolbox-session' ? 'tool' : 'mcp';
  return Object.freeze({ entrySurface, entrySource: 'confirmed_actor', journeyVersion: 1,
    entryReleaseSha: serverRelease(env) });
}

export function normalizeJobJourneyContext(context: JobJourneyContext | undefined, env: JobJourneyEnv = process.env): JobJourneyContext {
  if (context === undefined) return Object.freeze({ entrySurface: 'unknown', entrySource: 'unknown',
    journeyVersion: 1, entryReleaseSha: serverRelease(env) });
  if (!context || context.journeyVersion !== 1
    || !((context.entrySurface === 'generator' && context.entrySource === 'web_route')
      || (['tool', 'studio', 'mcp'].includes(context.entrySurface) && context.entrySource === 'confirmed_actor')
      || (context.entrySurface === 'unknown' && context.entrySource === 'unknown'))
    || !(context.entryReleaseSha === null || (typeof context.entryReleaseSha === 'string' && RELEASE_SHA.test(context.entryReleaseSha)))) {
    throw new Error('Invalid internal job journey context.');
  }
  return Object.freeze({ entrySurface: context.entrySurface, entrySource: context.entrySource,
    journeyVersion: context.journeyVersion, entryReleaseSha: context.entryReleaseSha });
}
