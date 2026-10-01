import { estimateAlibabaProviderCost } from '@/server/video-providers/alibaba-model-studio/cost';
import { isWan3EngineId } from '@/lib/wan3-pricing';
import type { NormalizedVideoProviderTask, ProviderCostEstimate } from '@/server/video-providers/types';

type AccountingJob = { engine_id: string; duration_sec: number; settings_snapshot: unknown; pricing_snapshot: unknown };
const record = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value)
  ? value as Record<string, unknown> : null;
const duration = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

/** LIST-rate usage estimate, never an account-effective invoice or a new customer charge. */
export function estimateAlibabaJobCost(job: AccountingJob, task?: NormalizedVideoProviderTask): ProviderCostEstimate & {
  status: 'list_estimate_from_provider_usage' | 'list_estimate_from_verified_durations' | 'list_estimate_unavailable';
  inputVideoDurationSec: number | null; outputVideoDurationSec: number | null;
} {
  const settings = record(job.settings_snapshot);
  const core = record(settings?.core);
  const mode = String(settings?.inputMode ?? settings?.mode ?? core?.inputMode ?? core?.mode ?? 't2v');
  const resolution = String(settings?.resolution ?? core?.resolution ?? '720p');
  const usage = record(record(task?.raw)?.usage);
  const aggregate = duration(usage?.duration);
  const reportedInput = duration(usage?.input_video_duration);
  const reportedOutput = duration(usage?.output_video_duration);
  const meta = record(record(job.pricing_snapshot)?.meta);
  const noVideoMode = ['t2v', 'i2v', 'fl2v'].includes(mode);
  const inputVideoDurationSec = !isWan3EngineId(job.engine_id) || noVideoMode ? 0
    : reportedInput ?? duration(meta?.input_video_duration_sec);
  const outputVideoDurationSec = reportedOutput ?? duration(job.duration_sec);
  const completeReported = aggregate != null || (reportedInput != null && reportedOutput != null);
  const seconds = aggregate ?? (inputVideoDurationSec == null || outputVideoDurationSec == null ? null
    : inputVideoDurationSec + outputVideoDurationSec);
  const estimate = estimateAlibabaProviderCost({ engineId: job.engine_id, mode, resolution,
    durationSec: seconds ?? 0, inputVideoDurationSec: 0 });
  return { ...estimate, providerCostUnits: seconds, providerCostUsd: seconds == null ? null : estimate.providerCostUsd,
    status: seconds == null ? 'list_estimate_unavailable' : completeReported
      ? 'list_estimate_from_provider_usage' : 'list_estimate_from_verified_durations',
    inputVideoDurationSec, outputVideoDurationSec };
}
