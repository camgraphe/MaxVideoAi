import type { AcceptedToolQuote } from '@/lib/toolbox/quote';
import { useCallback, useRef, useState } from 'react';
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
  acceptedQuote?: AcceptedToolQuote | null;
  backgroundColor: BackgroundRemovalStudioBackgroundColor;
  outputCodec: BackgroundRemovalOutputCodec;
  preserveAudio: boolean;
  source: BackgroundRemovalSourceAsset | null;
  metadata: BackgroundRemovalVideoMetadata | null;
  videoUrl: string;
  onSuccess?: () => void;
  onQuoteInvalidated?: () => void;
}) {
  const runningRef = useRef(false);
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
    if (!params.videoUrl.trim() || !params.metadata || runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    setError(null);
    setMessage(null);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tool_start', { detail: { tool: 'background-removal' } }));
    }
    try {
      const response = await runBackgroundRemovalTool({
        acceptedQuote: params.acceptedQuote ?? undefined,
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
      setMessage(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tool_success', { detail: { tool: 'background-removal', jobId: response.jobId } }));
      }
      params.onSuccess?.();
    } catch (runError) {
      params.onQuoteInvalidated?.();
      const nextMessage = runError instanceof Error ? runError.message : 'Background removal failed.';
      setError(nextMessage);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tool_error', { detail: { tool: 'background-removal', message: nextMessage } }));
      }
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  }, [params]);

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
