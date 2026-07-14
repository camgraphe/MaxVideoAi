import type { McpPageCopy } from '../_lib/mcp-page-types';
import type { McpProof } from '../_lib/mcp-proof';
import { McpProofMedia } from './McpProofMedia';

export function McpEvidenceSection({
  copy,
  proof,
}: {
  copy: McpPageCopy['evidence'];
  proof: McpProof | null;
}) {
  if (!proof) return null;

  return (
    <aside className="rounded-[16px] border border-hairline bg-surface p-3 text-text-primary shadow-card dark:border-white/[0.16] dark:bg-white/[0.04] dark:text-white">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2 px-1">
        <div>
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted dark:text-white/55">{copy.eyebrow}</p>
          <h2 className="mt-1 text-lg font-semibold text-text-primary dark:text-white">{copy.title}</h2>
          <span className="mt-2 inline-flex rounded-full border border-hairline bg-bg px-2.5 py-1 text-[11px] font-semibold text-text-primary dark:border-white/[0.14] dark:bg-white/[0.05] dark:text-white">
            {proof.badge}
          </span>
        </div>
        <p className="text-xs text-text-secondary dark:text-white/65">
          {copy.verifiedLabel}: {proof.verifiedAt}
        </p>
      </div>
      <McpProofMedia proof={proof} />
    </aside>
  );
}
