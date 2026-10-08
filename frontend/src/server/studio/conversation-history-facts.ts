import {query} from '@/lib/db';
import {STUDIO_CONVERSATION_MAX_REFERENCES} from '@/lib/studio/conversation-creation-contract';
import type {StudioConversationHistoryFacts} from '@/lib/studio/image-conversation-contract';
import {customerDisplayPrice} from '@/lib/customer-price-presentation';
import {requireGenerationActor,type StudioGenerationActor} from '@/server/agent-api/generation-actor';
import {AgentApiError} from '@/server/agent-api/errors';
import type {StoredImageTurn} from './image-conversation-repository';
import {projectStudioQuoteSettings,STUDIO_QUOTE_SETTING_KEYS} from './conversation-quote-facts';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const token=(value:unknown,max:number):value is string=>typeof value==='string'&&value.length<=max&&/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(value);
const MAX_HISTORICAL_FACTS=2;
const MAX_DIRECTION_CHARS=1600;

/** Only already-authorized ready history rows; creative text stays exact and is explicitly bounded. */
export function projectStudioQuoteDirections(turns:readonly StoredImageTurn[]):StudioConversationHistoryFacts['quoteDirections'] {
  const directions:StudioConversationHistoryFacts['quoteDirections']=[];
  for(const turn of [...turns].reverse()){
    if(turn.state!=='ready'||!turn.quote_id||!uuid.test(turn.quote_id)||!turn.draft_json)continue;
    const draft=turn.draft_json;
    const media=draft.media;
    let text=draft.image?.prompt??'';
    if(media){
      if(media.action==='voice.prepare')text=media.script;
      else{
        const script=media.action==='audio.prepare'?media.settings?.find(setting=>setting.name==='script')?.value:undefined;
        const lyrics=media.action==='audio.prepare'?media.settings?.find(setting=>setting.name==='lyrics')?.value:undefined;
        text=[media.prompt,typeof script==='string'?`Narration: ${script}`:'',typeof lyrics==='string'?`Lyrics: ${lyrics}`:''].filter(Boolean).join('\n\n');
      }
    }
    if(!text)continue;
    directions.push({requestId:turn.request_id,quoteId:turn.quote_id,text:text.slice(0,MAX_DIRECTION_CHARS),truncated:text.length>MAX_DIRECTION_CHARS});
    if(directions.length===MAX_HISTORICAL_FACTS)break;
  }
  return directions;
}

type EstimateRow={requestId:string;modelId:unknown;surface:unknown;mode:unknown;settings:unknown;outputCount:unknown;referenceCount:unknown;amountCents:unknown;currency:unknown;estimatedAt:unknown;quoteRequired:unknown;outputDurationSec:unknown};
function projectHistoricalEstimate(row:EstimateRow):StudioConversationHistoryFacts['estimates'][number]|null {
  if(!uuid.test(row.requestId)||!token(row.modelId,128)||!token(row.mode,64)||!['image','video'].includes(row.surface as string)
    ||row.outputCount!==1||typeof row.referenceCount!=='number'||!Number.isSafeInteger(row.referenceCount)||row.referenceCount<0||row.referenceCount>STUDIO_CONVERSATION_MAX_REFERENCES
    ||typeof row.amountCents!=='number'||!Number.isSafeInteger(row.amountCents)||row.amountCents<0||typeof row.currency!=='string'||!/^[A-Z]{3}$/.test(row.currency)
    ||typeof row.estimatedAt!=='string'||!Number.isFinite(Date.parse(row.estimatedAt))||row.quoteRequired!==true)return null;
  return {requestId:row.requestId,historical:true,modelId:row.modelId,surface:row.surface as 'image'|'video',mode:row.mode,
    settings:projectStudioQuoteSettings(row.settings),outputCount:1,referenceCount:row.referenceCount,
    price:customerDisplayPrice(row.amountCents,row.currency),estimatedAt:new Date(row.estimatedAt).toISOString(),quoteRequired:true,
    ...(typeof row.outputDurationSec==='number'&&Number.isFinite(row.outputDurationSec)&&row.outputDurationSec>0?{outputDurationSec:row.outputDurationSec}:{})};
}

/** Read completed owned estimates only. Historical prices never become a quote, reprice or purchase authorization. */
export async function readStudioHistoricalEstimates(actor:StudioGenerationActor,requestIds:readonly string[]):Promise<StudioConversationHistoryFacts['estimates']> {
  requireGenerationActor(actor);
  if(actor.authMethod!=='studio-session')throw new AgentApiError('AUTH_REQUIRED','Studio session required.');
  const ids=[...new Set(requestIds.filter(id=>uuid.test(id)))].slice(-8);
  if(!ids.length)return [];
  const rows=await query<EstimateRow>(`WITH receipts AS (
    SELECT s.request_id,s.result_json,s.created_at,s.call_id
    FROM studio_conversation_steps s JOIN studio_image_turns t ON t.user_id=s.user_id AND t.project_id=s.project_id AND t.request_id=s.request_id
    JOIN studio_projects p ON p.user_id=t.user_id AND p.id=t.project_id AND p.deleted_at IS NULL
    WHERE s.user_id=$1 AND s.project_id=$2 AND s.request_id=ANY($3::uuid[]) AND t.state='ready' AND s.state='completed'
      AND s.action_json->>'action' IN ('pricing.read','pricing.compare')
      AND s.result_json->>'action'=s.action_json->>'action' AND s.result_json->'ok'='true'::jsonb
    ORDER BY s.created_at DESC,s.call_id DESC LIMIT 2
  ) SELECT s.request_id AS "requestId",option.data->>'modelId' AS "modelId",
    option.data->>'surface' AS surface,option.data->>'mode' AS mode,
    (SELECT jsonb_object_agg(key,value) FROM jsonb_each(CASE WHEN jsonb_typeof(option.data->'settings')='object' THEN option.data->'settings' ELSE '{}'::jsonb END) WHERE key=ANY($4::text[])) AS settings,
    option.data->'outputCount' AS "outputCount",option.data->'referenceCount' AS "referenceCount",
    option.data->'price'->'amountCents' AS "amountCents",option.data->'price'->>'currency' AS currency,
    option.data->>'estimatedAt' AS "estimatedAt",option.data->'quoteRequired' AS "quoteRequired",
    option.data->'outputDurationSec' AS "outputDurationSec"
    FROM receipts s CROSS JOIN LATERAL (
      SELECT data,ordinal FROM jsonb_array_elements(CASE
        WHEN s.result_json->>'action'='pricing.read' THEN jsonb_build_array(s.result_json->'data')
        WHEN jsonb_typeof(s.result_json->'data'->'options')='array' THEN s.result_json->'data'->'options'
        ELSE '[]'::jsonb END) WITH ORDINALITY AS options(data,ordinal) LIMIT 3
    ) option ORDER BY s.created_at DESC,s.call_id DESC,option.ordinal LIMIT 6`,[actor.userId,actor.projectId,ids,STUDIO_QUOTE_SETTING_KEYS]);
  return rows.flatMap(row=>{const projected=projectHistoricalEstimate(row);return projected?[projected]:[];});
}
