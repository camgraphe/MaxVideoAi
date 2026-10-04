import type { EditorialDraft } from '@/lib/editorial/schema';

type Research = EditorialDraft['research'];

export function EditorialTrendResearch({ research }: { research: Research }) {
  return <section className="rounded-2xl border border-hairline bg-surface p-5 sm:p-7" aria-labelledby="trend-heading">
    <h2 id="trend-heading" className="text-lg font-bold text-text-primary">Topic and trend research</h2>
    <p className="mt-2 text-sm leading-6 text-text-secondary">Scanned {new Date(research.scannedAt).toLocaleString()} · Recommendation: {research.recommendation} · MaxVideoAI fit: {research.productFit.rationale}</p>
    {research.candidates?.length ? <div className="mt-5 space-y-3">
      <h3 className="text-sm font-bold text-text-primary">Topic shortlist</h3>
      <ul className="grid gap-3 sm:grid-cols-2">{research.candidates.map((candidate) => <li key={candidate.topicKey} className="rounded-xl border border-hairline bg-bg p-4">
        <span className="text-xs font-bold uppercase tracking-widest text-text-muted">{candidate.lane} · {candidate.score}/5 · {candidate.decision}</span>
        <h4 className="mt-2 font-semibold text-text-primary">{candidate.title}</h4>
        <p className="mt-2 text-sm leading-6 text-text-secondary">{candidate.rationale}</p>
        <p className="mt-2 text-xs text-text-muted">Evidence: {candidate.evidenceUrls.length} · Existing articles: {candidate.existingArticleSlugs.length}</p>
      </li>)}</ul>
    </div> : null}
    <ul className="mt-4 grid gap-3 sm:grid-cols-2">{research.signals.map((signal) => <li key={signal.url} className="rounded-xl border border-hairline bg-bg p-4">
      <span className="text-xs font-bold uppercase tracking-widest text-text-muted">{signal.platform} · {signal.observedAt} · relevance {signal.relevance}/5</span>
      <a href={signal.url} className="mt-2 block font-semibold text-text-primary underline underline-offset-4" rel="noopener noreferrer">{signal.title}</a>
      <p className="mt-2 text-sm leading-6 text-text-secondary">{signal.summary}</p>
    </li>)}</ul>
    <p className="mt-4 text-xs text-text-muted">Community posts help choose a topic. Article claims rely on the dated research sources below.</p>
  </section>;
}
