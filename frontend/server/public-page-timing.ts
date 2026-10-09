import type { AppLocale } from '@/i18n/locales';

export type PublicPagePhase = 'examples' | 'example-latest' | 'example-playlist' | 'example-families' | 'example-promotions' | 'hero-slots' | 'hero-pricing' | 'demo-pricing' | 'benchmark' | 'scores' | 'key-specs' | 'left-pricing' | 'right-pricing' | 'left-gallery' | 'right-gallery' | 'engine-settings' | 'model-gallery' | 'model-pricing' | 'theme-tokens';
export type MeasurePublicPagePhase = <T>(phase: PublicPagePhase, operation: () => Promise<T>) => Promise<T>;
export const withoutPublicPageTiming: MeasurePublicPagePhase = (_phase, operation) => operation();

type PhaseTiming = {
  phase: PublicPagePhase;
  startMs: number;
  durationMs: number | null;
  status: 'pending' | 'ok' | 'error';
};

export type PublicPageTimingRecord = {
  schema: 'cwv.server.v1';
  route: 'comparison' | 'home' | 'model' | 'root-layout';
  locale: AppLocale;
  deployment: string | null;
  status: 'ok' | 'error';
  dataDurationMs: number;
  phases: PhaseTiming[];
};

type TimingOptions = {
  enabled?: boolean;
  now?: () => number;
  emit?: (record: PublicPageTimingRecord) => void;
  deployment?: string | null;
};

/** One bounded server log per public-page data load. No SQL, URLs, IDs or error contents. */
export async function withPublicPageTiming<T>(
  context: Pick<PublicPageTimingRecord, 'route' | 'locale'>,
  load: (measure: MeasurePublicPagePhase) => Promise<T>,
  options: TimingOptions = {},
): Promise<T> {
  const enabled = options.enabled ?? (
    process.env.CWV_SERVER_TIMING !== '0'
    && process.env.NODE_ENV === 'production'
    && process.env.NEXT_PHASE !== 'phase-production-build'
  );
  if (!enabled) return load(withoutPublicPageTiming);

  const now = options.now ?? (() => performance.now());
  const start = now();
  const phases: PhaseTiming[] = [];
  let status: PublicPageTimingRecord['status'] = 'ok';
  const rounded = (duration: number) => Math.round(Math.max(0, duration) * 100) / 100;
  const measure: MeasurePublicPagePhase = async (phase, operation) => {
    const phaseStart = now();
    const timing: PhaseTiming = { phase, startMs: rounded(phaseStart - start), durationMs: null, status: 'pending' };
    phases.push(timing);
    try {
      const result = await operation();
      timing.status = 'ok';
      return result;
    } catch (error) {
      timing.status = 'error';
      throw error;
    } finally {
      timing.durationMs = rounded(now() - phaseStart);
    }
  };
  try {
    return await load(measure);
  } catch (error) {
    status = 'error';
    throw error;
  } finally {
    const record: PublicPageTimingRecord = {
      schema: 'cwv.server.v1', route: context.route, locale: context.locale,
      deployment: options.deployment ?? process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      status, dataDurationMs: rounded(now() - start), phases: phases.map(phase => ({ ...phase })),
    };
    try {
      if (options.emit) options.emit(record);
      else console.info('[cwv:server]', JSON.stringify(record));
    } catch {
      // Diagnostics must never change the public response or original error.
    }
  }
}
