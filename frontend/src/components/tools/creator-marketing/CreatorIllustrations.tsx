import React from 'react';
import type { CreatorToolId } from '@/lib/toolbox/creator-availability';
import { CreatorArtwork } from './CreatorArtwork';

/** Decorative presentation art for discovery cards; never an operation output. */
export function CreatorToolMark({ id }: { id: CreatorToolId }) {
  return <div className="creator-tool-mark aspect-[3/2] overflow-hidden rounded-lg" aria-hidden="true">
    <CreatorArtwork id={id} alt="" className="h-full w-full object-cover" sizes="(max-width: 760px) 90vw, 30vw" />
  </div>;
}
