import { createHash } from 'node:crypto';

const namespace = '01234567-89ab-4cde-8fab-0123456789ab';
const origin = 'https://source.example.com';
export const fixtureVideoId = 'b95c603e-2339-440e-b50e-7b7b2757da3c';

export function publicationFile(contents: string, mime = 'video/mp4', extension = 'mp4') {
  const bytes = Buffer.from(contents);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  return {
    bytes,
    entry: { url: `${origin}/marketing-media/${namespace}/${sha256}.${extension}`, mime, sizeBytes: bytes.length, sha256 },
  };
}

export const selectedVideo = publicationFile('approved film with music');
export const staleVideo = publicationFile('previous film with voice-over');
export const stalePreview = publicationFile('previous voice-over preview');
export const poster = publicationFile('approved poster', 'image/jpeg', 'jpg');
export const reference = publicationFile('approved source scene');
export const nestedReference = publicationFile('approved character image', 'image/png', 'png');
export const importFiles = [selectedVideo, poster, reference, nestedReference];
export const allExportedFiles = [staleVideo, poster, stalePreview, reference, nestedReference, selectedVideo];

export function publicationManifest(videoId = fixtureVideoId) {
  const recreationSnapshot = {
    schemaVersion: 1,
    surface: 'video',
    engineId: 'wan-3-prime',
    inputMode: 'v2v',
    prompt: 'Exact public prompt with no voice-over',
    core: { audio: true, resolution: '720p', aspectRatio: '9:16', durationSec: 14 },
    advanced: { extraInputValues: { elements: [{ frontal_image: nestedReference.entry.url }] } },
    refs: { videoUrls: [reference.entry.url] },
  };
  return {
    schemaVersion: 'maxvideoai-marketing-publication/v1',
    source: { url: `https://preview.example.com/api/examples/${videoId}`, exportedAt: '2026-11-07T02:12:38.638Z' },
    publication: {
      job_id: videoId,
      status: 'completed',
      surface: 'video',
      user_id: null,
      engine_id: 'wan-3-prime',
      engine_label: 'MaxVideoAI Recast',
      title: 'Vesper',
      prompt: recreationSnapshot.prompt,
      visibility: 'public',
      indexable: true,
      featured: false,
      featured_order: 0,
      created_at: '2026-11-05T13:43:14.390358+00:00',
      duration_sec: 14,
      aspect_ratio: '9:16',
      has_audio: true,
      video_url: selectedVideo.entry.url,
      thumb_url: poster.entry.url,
      preview_video_url: null,
      playback_video_url: null,
      marketing_output_width: 720,
      marketing_output_height: 1280,
      settings_snapshot: structuredClone(recreationSnapshot),
    },
    recreationSnapshot,
    files: allExportedFiles.map(({ entry }) => ({ ...entry })),
  };
}
