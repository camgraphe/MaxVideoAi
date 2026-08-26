import Image from 'next/image';
import type { McpHostProof } from '../_lib/mcp-host-proof';

export function McpHostProofCard({ proof, priority = false }: { proof: McpHostProof; priority?: boolean }) {
  return (
    <figure
      data-mcp-host-proof={proof.host}
      className="overflow-hidden rounded-[18px] border border-hairline bg-white shadow-sm dark:border-white/[0.14] dark:bg-neutral-900"
    >
      <div className="border-b border-hairline bg-surface px-4 py-3 dark:border-white/[0.1] dark:bg-white/[0.045]">
        <p className="text-xs font-semibold uppercase tracking-micro text-text-secondary dark:text-white/68">
          {proof.eyebrow}
        </p>
      </div>
      <Image
        src={proof.assetSrc}
        alt={proof.alt}
        width={proof.width}
        height={proof.height}
        priority={priority}
        sizes="(min-width: 1024px) 46vw, 100vw"
        className="h-auto w-full bg-white object-contain dark:bg-neutral-900"
      />
      <figcaption className="border-t border-hairline bg-bg px-5 py-4 dark:border-white/[0.1] dark:bg-bg">
        <h2 className="text-base font-semibold text-text-primary dark:text-white">{proof.heading}</h2>
        <p className="mt-2 text-sm leading-6 text-text-secondary dark:text-white/70">{proof.caption}</p>
      </figcaption>
    </figure>
  );
}
