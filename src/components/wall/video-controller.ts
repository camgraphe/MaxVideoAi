const playingVideos = new Set<HTMLVideoElement>();

export function requestPlay(video: HTMLVideoElement) {
  if (!video) return;

  if (!playingVideos.has(video)) {
    playingVideos.add(video);
    while (playingVideos.size > 9) {
      const oldest = playingVideos.values().next().value as HTMLVideoElement | undefined;
      if (!oldest) break;
      oldest.pause();
      oldest.currentTime = 0;
      playingVideos.delete(oldest);
    }
  }

  void video.play().catch(() => {
    // Autoplay might get blocked; poster remains visible
  });
}

export function pauseVideo(video: HTMLVideoElement | null, reset = false) {
  if (!video) return;
  if (playingVideos.has(video)) {
    playingVideos.delete(video);
  }
  video.pause();
  if (reset) {
    video.currentTime = 0;
  }
}

export function pauseAllVideos() {
  for (const video of playingVideos) {
    video.pause();
    video.currentTime = 0;
  }
  playingVideos.clear();
}
