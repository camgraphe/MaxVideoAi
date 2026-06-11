import { useCallback, useState } from 'react';
import { runBackgroundRemovalTool } from '@/lib/api';
import type {
  BackgroundRemovalOutputCodec,
  BackgroundRemovalStudioBackgroundColor,
} from '@/types/tools-background-removal';
import type {
  BackgroundRemovalResult,
  BackgroundRemovalSourceAsset,
  BackgroundRemovalVideoMetadata,
} from '../_lib/background-removal-workspace-types';

export function useBackgroundRemovalGenerationRunner(params: {
  backgroundColor: BackgroundRemovalStudioBackgroundColor;
  outputCodec: BackgroundRemovalOutputCodec;
  preserveAudio: boolean;
  source: BackgroundRemovalSourceAsset | null;
  metadata: BackgroundRemovalVideoMetadata | null;
  videoUrl: string;
  onSuccess?: () => void;
}) {
  const [result, setResult] = useState<BackgroundRemovalResult | null>(null);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearResult = useCallback(() => {
    setResult(null);
    setMessage(null);
    setError(null);
  }, []);

  const run = useCallback(async () => {
    if (!params.videoUrl.trim() || !params.metadata || running) return;
    setRunning(true);
    setError(null);
    setMessage(null);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tool_start', { detail: { tool: 'background-removal' } }));
    }
    try {
      const response = await runBackgroundRemovalTool({
        videoUrl: params.videoUrl.trim(),
        backgroundColor: params.backgroundColor,
        outputContainerAndCodec: params.outputCodec,
        preserveAudio: params.preserveAudio,
        sourceJobId: params.source?.jobId ?? null,
        sourceAssetId: params.source?.id ?? null,
        videoWidth: params.metadata.width ?? null,
        videoHeight: params.metadata.height ?? null,
        durationSec: params.metadata.durationSec,
        fps: params.metadata.fps ?? null,
      });
      setResult(response);
      setMessage(`${response.engineLabel} · $${response.pricing.estimatedCostUsd.toFixed(2)}`);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tool_success', { detail: { tool: 'background-removal', jobId: response.jobId } }));
      }
      params.onSuccess?.();
    } catch (runError) {
      const nextMessage = runError instanceof Error ? runError.message : 'Background removal failed.';
      setError(nextMessage);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tool_error', { detail: { tool: 'background-removal', message: nextMessage } }));
      }
    } finally {
      setRunning(false);
    }
  }, [params, running]);

  return {
    clearResult,
    error,
    message,
    result,
    run,
    running,
    setError,
    setMessage,
    setResult,
  };
}
