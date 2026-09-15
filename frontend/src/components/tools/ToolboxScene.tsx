import Image from 'next/image';
import type { ToolboxVisualId } from './toolbox-copy';
import { QUICK_TOOL_ART, WORKSHOP_ART, isQuickToolArtId } from './toolbox-art';

/** Editorial artwork shared with the catalogue; the owning surface labels it as an illustration. */
export function ToolboxScene({ kind }: { kind: ToolboxVisualId }) {
  const src = isQuickToolArtId(kind) ? QUICK_TOOL_ART[kind] : WORKSHOP_ART[kind];
  return <Image src={src} alt="" fill sizes="(max-width: 700px) 100vw, 70vw" loading="lazy" className="object-cover" />;
}
