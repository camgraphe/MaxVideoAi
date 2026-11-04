/** Additive HTTP response capability only: never authorization, paid consent or request identity. */
export const PROMPT_INLINE_ANALYSIS_HEADER='x-milo-inline-analysis';
export function promptInlineAnalysisHeaders(initial?:HeadersInit):Headers {
  const headers=new Headers(initial);headers.set(PROMPT_INLINE_ANALYSIS_HEADER,'1');return headers;
}
