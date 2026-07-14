import type { McpProof } from '../_lib/mcp-proof';

export function McpProofMedia({ proof }: { proof: McpProof }) {
  return (
    <figure className="overflow-hidden rounded-[14px] border border-hairline bg-surface text-text-primary shadow-card dark:border-white/[0.16] dark:bg-white/[0.045] dark:text-white">
      <video
        aria-describedby="mcp-proof-caption"
        className="aspect-video w-full bg-black object-cover dark:ring-1 dark:ring-white/[0.06]"
        controls
        playsInline
        poster={proof.posterSrc}
        preload="metadata"
        src={proof.videoSrc}
      >
        <track
          default
          kind="captions"
          src={proof.captionsSrc}
          srcLang={proof.captionsLocale}
        />
      </video>
      <figcaption id="mcp-proof-caption" className="border-t border-hairline bg-surface px-4 py-3 text-sm leading-6 text-text-secondary dark:border-white/[0.12] dark:bg-white/[0.035] dark:text-white/70">
        {proof.caption}
      </figcaption>
    </figure>
  );
}
