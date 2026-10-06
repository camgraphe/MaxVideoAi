/** Extraction (120s) + native count (65s), then a fresh provider phase (65s).
 * Each phase includes database/cleanup headroom. A late known reply keeps its
 * original worker fence and can settle; expiry never authorizes redispatch. */
export function studioAnalysisLeaseExpiredSql(alias:''|'r.'='') {
  return `((${alias}dispatched_at IS NULL AND ${alias}started_at<clock_timestamp()-interval '4 minutes')
    OR (${alias}dispatched_at IS NOT NULL AND ${alias}dispatched_at<clock_timestamp()-interval '2 minutes'))`;
}
