'use client';

import ReactDOM from 'react-dom';

export function VideoWatchPosterPreload({ poster }: { poster: string }) {
  // Use the same resource hint API as next/image so the App Router emits this
  // critical image before blocking styles, while retaining the exact video poster.
  if (typeof ReactDOM.preload === 'function') {
    ReactDOM.preload(poster, { as: 'image', fetchPriority: 'high' });
    return null;
  }
  return <link rel="preload" as="image" href={poster} fetchPriority="high" />;
}
