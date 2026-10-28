import publicVideoSources from '@/config/public-video-sources.json';

export type VideoBackgroundClip = {
  src: string;
  poster: string;
  width: number;
  height: number;
  durationSec: number;
};

export type VideoBackgroundMedia = { source: VideoBackgroundClip; result: VideoBackgroundClip };

const publicSource = (assetId: string) => {
  const source = publicVideoSources.sources.find(item => item.assetId === assetId);
  if (!source) throw new Error(`Missing approved public source: ${assetId}`);
  return source.url;
};

// The exact public copies must be approved and byte/HTTP verified before this activation.
export const PUBLISHED_VIDEO_BACKGROUND_MEDIA: VideoBackgroundMedia | null = {
  "source": {
    "src": publicSource('video-background-source'),
    "poster": "https://media.maxvideoai.com/authored/video-background-changer/e0c5be8c1bedfa8e06c899254cf2417005513f13f5efcf4dd583bf2f09948e6a.webp",
    "width": 1920,
    "height": 1080,
    "durationSec": 6
  },
  "result": {
    "src": publicSource('video-background-cockpit'),
    "poster": "https://media.maxvideoai.com/authored/video-background-changer/80f864726dafe8184adc8ba587193603bfa7a7e1828a36a38744a5db903c537a.webp",
    "width": 1280,
    "height": 720,
    "durationSec": 6.037007
  }
};
