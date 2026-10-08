import type {StudioConversationProject,StudioConversationQuoteFacts,StudioConversationQuoteSettings} from '@/lib/studio/conversation-action-contract';
import {customerDisplayPrice} from '@/lib/customer-price-presentation';

const settingTypes: Record<keyof StudioConversationQuoteSettings,'boolean'|'number'|'string'> = {
  audio:'boolean',durationSec:'number',resolution:'string',aspectRatio:'string',quality:'string',
  imageWidth:'number',imageHeight:'number',outputFormat:'string',fps:'number',loop:'boolean',
  hdr:'boolean',exrExport:'boolean',enableWebSearch:'boolean',voiceModel:'string',musicModel:'string',
  seedAudioOutputFormat:'string',seedAudioSampleRate:'number',
  musicEnabled:'boolean',exportAudioFile:'boolean',language:'string',startTimeSec:'number',retakeMode:'string',extendPosition:'string',
};
export const STUDIO_QUOTE_SETTING_KEYS = Object.freeze(Object.keys(settingTypes));
const referenceRoles = new Set<StudioConversationQuoteFacts['referenceRoles'][number]>([
  'source','reference','first_frame','last_frame','mask','source_video','voice_sample',
]);
const MAX_QUOTE_FACTS = 8;

export type StudioConversationQuoteRow = {
  quoteId: string; surface: string; quoteState: string; jobId: string | null; status: string | null;
  amountCents: unknown; currency: unknown; expiresAt: Date | string; databaseNow: Date | string;
  modelId: unknown; mode: unknown; settings: unknown; outputCount: unknown;
  referenceCount: unknown; referenceRoles: unknown;
  outputDurationSec?: unknown;
};

function positiveDuration(value:unknown):number|undefined {
  return typeof value==='number'&&Number.isFinite(value)&&value>0?value:undefined;
}

export {recordedGenerationOutputDuration as recordedStudioOutputDuration} from '@/lib/generation-output-duration';

function boundedToken(value: unknown,maxLength: number): value is string {
  return typeof value === 'string' && value.length <= maxLength && /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(value);
}

export function projectStudioQuoteSettings(value:unknown):StudioConversationQuoteSettings {
  const storedSettings = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string,unknown> : {};
  return Object.fromEntries(Object.entries(settingTypes).flatMap(([key,type]) => {
    const value = storedSettings[key];
    const safe = type === 'string' ? boundedToken(value,64)
      : type === 'number' ? typeof value === 'number' && Number.isFinite(value) && (key==='startTimeSec'?value>=0:value>0)
      : typeof value === 'boolean';
    return safe ? [[key,value]] : [];
  })) as StudioConversationQuoteSettings;
}

function safeQuoteFacts(row: StudioConversationQuoteRow): StudioConversationQuoteFacts | null {
  const expiresAt = new Date(row.expiresAt), now = new Date(row.databaseNow);
  if (!Number.isFinite(expiresAt.getTime()) || !Number.isFinite(now.getTime())
    || typeof row.amountCents !== 'number' || !Number.isSafeInteger(row.amountCents) || row.amountCents < 0
    || typeof row.currency !== 'string' || !/^[A-Z]{3}$/.test(row.currency)
    || !boundedToken(row.modelId,128) || !boundedToken(row.mode,64)
    || typeof row.outputCount !== 'number' || !Number.isSafeInteger(row.outputCount) || row.outputCount < 1 || row.outputCount > 15
    || typeof row.referenceCount !== 'number' || !Number.isSafeInteger(row.referenceCount) || row.referenceCount < 0 || row.referenceCount > 50) return null;
  const settings = projectStudioQuoteSettings(row.settings);
  const roles = Array.isArray(row.referenceRoles) ? row.referenceRoles.filter((role): role is StudioConversationQuoteFacts['referenceRoles'][number] =>
    typeof role === 'string' && referenceRoles.has(role as StudioConversationQuoteFacts['referenceRoles'][number])) : [];
  const outputDurationSec=row.surface==='video'?positiveDuration(row.outputDurationSec):undefined;
  return {price:customerDisplayPrice(row.amountCents,row.currency),expiresAt:expiresAt.toISOString(),
    expiredUnconfirmedQuote:row.quoteState === 'expired' || (row.quoteState === 'prepared' && expiresAt.getTime() <= now.getTime()),
    modelId:row.modelId,mode:row.mode,settings,outputCount:row.outputCount,
    ...(outputDurationSec===undefined?{}:{outputDurationSec}),
    referenceCount:row.referenceCount,referenceRoles:[...new Set(roles)]};
}

/** Recorded customer facts only. Scope is enforced by the reader; no pricing or purchase authority lives here. */
export function projectStudioConversationQuotes(rows: readonly StudioConversationQuoteRow[]): NonNullable<StudioConversationProject['generations']> {
  return rows.map((row,index) => {
    const summary = {quoteId:row.quoteId,surface:row.surface,quoteState:row.quoteState,jobId:row.jobId,status:row.status};
    const quote = index < MAX_QUOTE_FACTS ? safeQuoteFacts(row) : null;
    return quote ? {...summary,quote} : summary;
  });
}
