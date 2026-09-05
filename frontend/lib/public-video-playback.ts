import {
  resolvePublicVideoRendition,
  type ResolvedPublicVideoRendition,
} from '@/lib/public-video-renditions';

export type PublicVideoPlaybackSurface = 'home' | 'model' | 'examples';
export type PublicVideoPlaybackTrigger = 'user' | 'automatic';
export type PublicVideoMeasurementMethod = 'video_frame_callback' | 'playing_fallback';

export type PublicVideoPlaybackAttempt = {
  id: number;
  rendition: ResolvedPublicVideoRendition;
  trigger: PublicVideoPlaybackTrigger;
  startedAt: number;
  usedOriginalFallback: boolean;
};

export function selectPublicVideoPlaybackRendition(
  originalSrc: string,
  input: {
    viewportWidth: number;
    saveData: boolean;
    trigger: PublicVideoPlaybackTrigger;
  },
): ResolvedPublicVideoRendition {
  const profile = input.viewportWidth < 768 || (input.trigger === 'user' && input.saveData)
    ? 'mobile'
    : 'desktop';
  return resolvePublicVideoRendition(originalSrc, profile);
}

export function createPublicVideoOriginalFallbackAttempt(
  current: PublicVideoPlaybackAttempt,
  id: number,
): PublicVideoPlaybackAttempt {
  return {
    ...current,
    id,
    rendition: {
      ...current.rendition,
      src: current.rendition.originalSrc,
      profile: 'original',
    },
    usedOriginalFallback: true,
  };
}

type PlaybackMeasurementPayload = Record<string, string | number>;
type PlaybackMeasurementEmitter = (event: string, payload: PlaybackMeasurementPayload) => void;

type MeasuredVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: (now: number, metadata: { expectedDisplayTime: number }) => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

const MAX_STARTUP_MS = 120_000;
const MAX_REBUFFER_MS = 120_000;
const MAX_REBUFFER_EVENTS = 5;
const MAX_ERROR_EVENTS = 2;

function boundedMilliseconds(value: number, maximum: number): number {
  if (!Number.isFinite(value)) return maximum;
  return Math.min(maximum, Math.max(0, Math.round(value)));
}

export type PublicVideoPlaybackMeasurement = ReturnType<typeof createPublicVideoPlaybackMeasurement>;

export function createPublicVideoPlaybackMeasurement(input: {
  attempt: PublicVideoPlaybackAttempt;
  surface: PublicVideoPlaybackSurface;
  emit: PlaybackMeasurementEmitter;
  now?: () => number;
}) {
  const now = input.now ?? (() => performance.now());
  let active = true;
  let intended = false;
  let visible = true;
  let presented = false;
  let pendingFrame: { video: MeasuredVideo; handle: number } | null = null;
  let attachedVideo: MeasuredVideo | null = null;
  let rebufferStartedAt: number | null = null;
  let rebufferCount = 0;
  let errorCount = 0;

  const commonPayload = (): PlaybackMeasurementPayload | null => {
    const { assetId, profile } = input.attempt.rendition;
    if (!assetId) return null;
    return {
      asset_id: assetId,
      playback_profile: profile,
      playback_surface: input.surface,
      playback_trigger: input.attempt.trigger,
    };
  };

  const cancelPendingFrame = () => {
    if (!pendingFrame) return;
    pendingFrame.video.cancelVideoFrameCallback?.(pendingFrame.handle);
    pendingFrame = null;
  };

  const abandonRebuffer = () => {
    rebufferStartedAt = null;
  };

  const reportFirstFrame = (method: PublicVideoMeasurementMethod, presentedAt: number) => {
    if (!active || presented || !intended || !visible) return;
    presented = true;
    const payload = commonPayload();
    if (!payload) return;
    input.emit('public_video_startup', {
      ...payload,
      measurement_method: method,
      duration_ms: boundedMilliseconds(presentedAt - input.attempt.startedAt, MAX_STARTUP_MS),
    });
  };

  const armPresentedFrame = (video: MeasuredVideo) => {
    if (
      !active || presented || pendingFrame || !intended || !visible
      || typeof video.requestVideoFrameCallback !== 'function'
    ) return;
    const handle = video.requestVideoFrameCallback((callbackNow, metadata) => {
      if (!pendingFrame || pendingFrame.handle !== handle || pendingFrame.video !== video) return;
      pendingFrame = null;
      // expectedDisplayTime is the browser's presentation clock; callbackNow is the safe fallback.
      const presentedAt = Number.isFinite(metadata.expectedDisplayTime) ? metadata.expectedDisplayTime : callbackNow;
      reportFirstFrame('video_frame_callback', presentedAt);
    });
    pendingFrame = { video, handle };
  };

  const finishRebuffer = () => {
    if (rebufferStartedAt === null) return;
    const startedAt = rebufferStartedAt;
    rebufferStartedAt = null;
    if (!active || !intended || !visible) return;
    rebufferCount += 1;
    const payload = commonPayload();
    if (!payload) return;
    input.emit('public_video_rebuffer', {
      ...payload,
      duration_ms: boundedMilliseconds(now() - startedAt, MAX_REBUFFER_MS),
      rebuffer_count: rebufferCount,
    });
  };

  return {
    setContext(next: { intended: boolean; visible: boolean }) {
      intended = next.intended;
      visible = next.visible;
      if (!intended || !visible) {
        cancelPendingFrame();
        abandonRebuffer();
      } else if (attachedVideo) {
        armPresentedFrame(attachedVideo);
      }
    },
    attach(video: HTMLVideoElement) {
      attachedVideo = video as MeasuredVideo;
      armPresentedFrame(attachedVideo);
    },
    playing(video: HTMLVideoElement) {
      if (!active || !intended || !visible) return;
      finishRebuffer();
      const measuredVideo = video as MeasuredVideo;
      attachedVideo = measuredVideo;
      if (!presented && typeof measuredVideo.requestVideoFrameCallback !== 'function') {
        reportFirstFrame('playing_fallback', now());
      }
      armPresentedFrame(measuredVideo);
    },
    waiting() {
      if (
        !active || !presented || !intended || !visible || rebufferStartedAt !== null
        || rebufferCount >= MAX_REBUFFER_EVENTS
      ) return;
      rebufferStartedAt = now();
    },
    pause() {
      cancelPendingFrame();
      abandonRebuffer();
    },
    error(errorCode?: number | null) {
      cancelPendingFrame();
      abandonRebuffer();
      if (!active || errorCount >= MAX_ERROR_EVENTS) return;
      errorCount += 1;
      const payload = commonPayload();
      if (!payload) return;
      const nativeCode = typeof errorCode === 'number' && Number.isInteger(errorCode) && errorCode >= 1 && errorCode <= 4
        ? errorCode
        : undefined;
      input.emit('public_video_error', {
        ...payload,
        ...(nativeCode === undefined ? {} : { media_error_code: nativeCode }),
      });
    },
    dispose() {
      active = false;
      attachedVideo = null;
      cancelPendingFrame();
      abandonRebuffer();
    },
  };
}
