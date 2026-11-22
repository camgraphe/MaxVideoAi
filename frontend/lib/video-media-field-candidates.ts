export const VIDEO_MEDIA_FIELD_CANDIDATES = Object.freeze({
  firstFrame: ['first_frame_url', 'start_image_url', 'image_url'],
  lastFrame: ['last_frame_url', 'end_image_url'],
  referenceImage: ['image_urls', 'reference_images', 'reference_image_urls', 'reference_image_url'],
  referenceVideo: ['video_urls', 'reference_video_urls'],
  referenceAudio: ['audio_urls', 'reference_audio_urls'],
  sourceAudio: ['audio_url'],
  sourceVideo: ['video_url', 'extension_source_videos', 'video_urls'],
} as const);
