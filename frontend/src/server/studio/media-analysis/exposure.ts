import type {QueryExecutor} from '@/lib/db';
import {STUDIO_ASSISTANCE_CAMPAIGN_ID} from '../assistance-policy';
/** Also reads historical holds when activation is disabled. No grant, DDL or writes. */
export async function readStudioAnalysisExposure(db:QueryExecutor,userId?:string) {
  const ready=(await db.query<{ready:boolean}>("SELECT to_regclass('public.studio_analysis_credit_funding') IS NOT NULL ready"))[0]?.ready;
  if(!ready)return {sponsoredNanoUsd:0,unresolved:0};
  const row=(await db.query<{sponsored:string;unresolved:string}>(`SELECT COALESCE(sum(COALESCE(f.charged_sponsored_nano_usd,f.reserved_sponsored_nano_usd)),0)::text sponsored,
    count(*) FILTER(WHERE r.state='unknown' OR (r.state='running' AND r.started_at<clock_timestamp()-interval '3 minutes'))::text unresolved
    FROM studio_media_analysis_runs r JOIN studio_analysis_credit_funding f ON f.call_id=r.id WHERE ($1::text IS NULL OR r.user_id=$1) AND f.campaign_id=$2`,[userId??null,STUDIO_ASSISTANCE_CAMPAIGN_ID]))[0];
  return {sponsoredNanoUsd:Number(row?.sponsored??0),unresolved:Number(row?.unresolved??0)};
}
