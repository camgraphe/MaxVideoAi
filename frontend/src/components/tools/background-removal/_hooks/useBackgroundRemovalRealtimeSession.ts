import { useCallback, useEffect, useRef, useState } from 'react';
import { fal } from '@fal-ai/client';
import { startBackgroundRemovalRealtimeSession } from '@/lib/api';
import type {
  BackgroundRemovalRealtimeBackgroundType,
  BackgroundRemovalRealtimeSessionResponse,
} from '@/types/tools-background-removal';

type RealtimeConnection = {
  send(input: Record<string, unknown>): void;
  close(): void;
};

export function useBackgroundRemovalRealtimeSession(params: {
  backgroundType: BackgroundRemovalRealtimeBackgroundType;
  backgroundColor: string;
  blurStrength: number;
  backgroundImageUrl: string;
}) {
  const [session, setSession] = useState<BackgroundRemovalRealtimeSessionResponse | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [previewPayload, setPreviewPayload] = useState<unknown>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'live' | 'ended' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const connectionRef = useRef<RealtimeConnection | null>(null);
  const timerRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    connectionRef.current?.close();
    connectionRef.current = null;
    if (timerRef.current != null && typeof window !== 'undefined') {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
    setRemainingSeconds(0);
    setStatus((current) => (current === 'idle' ? 'idle' : 'ended'));
  }, [stream]);

  useEffect(() => () => stop(), [stop]);

  const start = useCallback(
    async (sessionSeconds: 30 | 60 | 120 = 60) => {
      setStatus('connecting');
      setError(null);
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        setStream(mediaStream);
        const nextSession = await startBackgroundRemovalRealtimeSession({
          engineId: 'bria-video-background-removal-realtime',
          sessionSeconds,
          backgroundType: params.backgroundType,
          backgroundColor: params.backgroundColor as never,
          blurStrength: params.blurStrength,
          backgroundImageUrl: params.backgroundImageUrl || null,
        });
        setSession(nextSession);
        setRemainingSeconds(nextSession.sessionSeconds);
        fal.config({
          credentials: () => nextSession.token,
          suppressLocalCredentialsWarning: true,
        });
        const connection = fal.realtime.connect('bria/video/background-removal/realtime', {
          connectionKey: nextSession.jobId,
          clientOnly: true,
          maxBuffering: 2,
          tokenProvider: async () => nextSession.token,
          tokenExpirationSeconds: nextSession.tokenExpirationSeconds,
          onResult: (result: unknown) => {
            setPreviewPayload(result);
          },
          onError: (nextError: Error) => {
            setError(nextError.message);
            setStatus('error');
          },
        } as never) as RealtimeConnection;
        connectionRef.current = connection;
        connection.send({
          ...nextSession.realtimeInput,
          stream: mediaStream,
        });
        setStatus('live');
        if (typeof window !== 'undefined') {
          timerRef.current = window.setInterval(() => {
            setRemainingSeconds((current) => {
              if (current <= 1) {
                window.clearInterval(timerRef.current ?? undefined);
                timerRef.current = null;
                connection.close();
                mediaStream.getTracks().forEach((track) => track.stop());
                setStatus('ended');
                return 0;
              }
              return current - 1;
            });
          }, 1000);
        }
      } catch (startError) {
        setError(startError instanceof Error ? startError.message : 'Realtime preview failed.');
        setStatus('error');
      }
    },
    [params.backgroundColor, params.backgroundImageUrl, params.backgroundType, params.blurStrength]
  );

  return {
    error,
    previewPayload,
    remainingSeconds,
    session,
    start,
    status,
    stop,
    stream,
  };
}
