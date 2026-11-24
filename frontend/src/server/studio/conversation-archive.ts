import {query} from '@/lib/db';
import {projectStudioReply} from '@/lib/studio/conversation-reply';
import {projectStudioQuotedReply} from './conversation-quote-reply';
import type {StudioConversationArchiveEntry} from '@/lib/studio/image-conversation-contract';
import type {StudioConversationQuoteFacts} from '@/lib/studio/conversation-action-contract';
import {requireGenerationActor, type StudioGenerationActor} from '@/server/agent-api/generation-actor';
import {AgentApiError} from '@/server/agent-api/errors';
import {projectStudioQuoteSettings, STUDIO_QUOTE_SETTING_KEYS} from './conversation-quote-facts';

type Render = NonNullable<StudioConversationArchiveEntry['render']>;
type ArchiveRow = {
  requestId: string;
  createdAt: Date;
  selectedFor: StudioConversationArchiveEntry['selectedFor'];
  imageIds: unknown;
  attachments: unknown;
  mentions: unknown;
  message: string | null;
  reply: string | null;
  quoteId: string | null;
  modelId: string | null;
  surface: string | null;
  mode: string | null;
  settings: unknown;
  direction: string | null;
  shots: unknown;
  references: unknown;
  jobId: string | null;
  status: string | null;
  outputs: Render['outputs'];
};

const referenceRoles: readonly StudioConversationQuoteFacts['referenceRoles'][number][] = [
  'source', 'reference', 'first_frame', 'middle_frame', 'last_frame', 'mask', 'source_video', 'voice_sample',
];
const commonWords = new Set(('the with for from this that what which and give show please about previous first original version ' +
  'les des une avec pour dans est que quel quelle cette premier première version ' +
  'los las del una con para que cuál del este esta primero primera original').split(' '));
const identifier = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length <= max && /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(value);
const maxArchiveChars = 6500;

function excerpt(text: string | null, limit: number, terms: readonly string[]) {
  if (!text) return '';
  const clean = text.replace(/\b(?:https?:\/\/|s3:\/\/|blob:|data:)\S+/gi, '[URL]').trim();
  if (clean.length <= limit) return clean;
  const lower = clean.toLowerCase();
  const match = terms.map(term => lower.indexOf(term)).find(index => index >= 0) ?? 0;
  const start = Math.min(clean.length - limit, Math.max(0, match - Math.floor(limit / 3)));
  return (start ? '…' : '') + clean.slice(start, start + limit) + (start + limit < clean.length ? '…' : '');
}

function projectAttachments(row: ArchiveRow): NonNullable<StudioConversationArchiveEntry['attachments']> {
  const images = Array.isArray(row.imageIds) ? row.imageIds.map(assetId => ({assetId, kind: 'image'})) : [];
  const media = Array.isArray(row.attachments) ? row.attachments.filter(ref => ref?.type === 'asset') : [];
  return [...images, ...media].slice(0, 8).flatMap(ref => {
    if (typeof ref.assetId !== 'string' || !/^ma_[a-f0-9]{32}$/.test(ref.assetId) || !['image','video','audio'].includes(ref.kind)) return [];
    const label = Array.isArray(row.mentions) ? row.mentions.find(item => item?.assetId === ref.assetId)?.label : null;
    return [{assetId: ref.assetId, kind: ref.kind, ...(typeof label === 'string' && /^(Image|Video|Audio) [1-9]\d{0,5}$/.test(label) ? {label} : {})}];
  });
}

function projectRender(row: ArchiveRow, terms: readonly string[]): Render | undefined {
  if (!row.quoteId || !identifier(row.modelId, 128) || !identifier(row.mode, 64) ||
      (row.surface !== 'image' && row.surface !== 'video' && row.surface !== 'audio')) return;
  const storedReferences = Array.isArray(row.references) ? row.references : [];
  const references: Render['references'] = [];
  for (const ref of storedReferences.slice(0, 8)) {
    const assetId = ref?.kind === 'asset' ? ref.assetId : ref?.asset?.type === 'asset' ? ref.asset.assetId : undefined;
    if (typeof assetId === 'string' && /^ma_[a-f0-9]{32}$/.test(assetId) && referenceRoles.includes(ref.role)) {
      references.push({assetId, role: ref.role, ...(Number.isSafeInteger(ref.slot) && ref.slot >= 0 ? {slot: ref.slot} : {})});
    }
  }
  const shots = Array.isArray(row.shots) ? row.shots.flatMap((shot, index) =>
    typeof shot?.prompt === 'string' && Number.isFinite(shot.durationSec)
      ? [`Shot ${index + 1} · ${shot.durationSec} s\n${shot.prompt}`] : []) : [];
  const direction = excerpt(shots.join('\n\n') || row.direction, 800, terms);
  return {
    quoteId: row.quoteId, modelId: row.modelId, surface: row.surface, mode: row.mode,
    settings: projectStudioQuoteSettings(row.settings), ...(direction ? {direction} : {}),
    references, referenceCount: storedReferences.length,
    jobId: row.jobId, status: row.status, outputs: row.outputs,
  };
}

/** Read only ready, older turns in this live project. The cursor is an owned turn, not a client timestamp. */
export async function readStudioConversationArchive(
  actor: StudioGenerationActor, beforeRequestId: string, message: string,
): Promise<StudioConversationArchiveEntry[]> {
  requireGenerationActor(actor);
  if (actor.authMethod !== 'studio-session') throw new AgentApiError('AUTH_REQUIRED', 'Studio session required.');
  const terms = [...new Set(message.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu))].filter(term => !commonWords.has(term)).slice(0, 24);
  const ids = [...new Set(message.match(/[\w][\w.:-]{2,255}/g))].map(token => token.replace(/[.:]+$/, ''));
  const text = message.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const first = /\b(?:first|earliest|originale?s?|initiale?s?|premier(?:e|es|s)?|primer[oa]?s?|v1)\b/.test(text);
  const surface = /\b(?:videos?|clips?|films?)\b/.test(text) ? 'video'
    : /\b(?:images?|photos?|imagenes?|fotos?)\b/.test(text) ? 'image'
    : /\b(?:audio|sound|music|musique|musica)\b/.test(text) ? 'audio' : null;
  const rows = await query<ArchiveRow>(`
    WITH older AS (
      SELECT t.request_id,t.created_at,t.input_json->>'message' AS message,t.draft_json->>'reply' AS reply,
        q.quote_id,q.state AS quote_state,q.request_json->>'surface' AS surface,q.request_json->>'engineId' AS model_id,
        COALESCE(NULLIF(q.request_json->>'prompt',''),q.request_json->'settings'->>'script',
          q.request_json->'settings'->>'lyrics',q.request_json->'settings'->>'multiPrompt','') AS direction,
        j.job_id,j.status
      FROM studio_image_turns t
      JOIN studio_projects p ON p.user_id=t.user_id AND p.id=t.project_id AND p.deleted_at IS NULL
      JOIN studio_image_turns boundary ON boundary.user_id=t.user_id AND boundary.project_id=t.project_id AND boundary.request_id=$3
      LEFT JOIN mcp_generation_quotes q ON q.quote_id=t.quote_id AND q.user_id=t.user_id
        AND q.studio_project_id=t.project_id AND q.auth_origin='studio-session'
      LEFT JOIN app_jobs j ON j.user_id=q.user_id AND j.job_id=q.job_id AND j.hidden IS NOT TRUE
      WHERE t.user_id=$1 AND t.project_id=$2 AND t.state='ready' AND (t.created_at,t.request_id)<(boundary.created_at,boundary.request_id)
    ), choices AS (
      (SELECT request_id,'exact_id' AS reason,0 AS priority,1.0 AS score FROM older
       WHERE request_id::text=ANY($4) OR quote_id::text=ANY($4) OR job_id=ANY($4)
         OR (quote_state='accepted' AND status='completed' AND job_id IN
           (SELECT o.job_id FROM job_outputs o WHERE o.user_id=$1 AND o.status='ready' AND o.id=ANY($4)))
       ORDER BY created_at DESC,request_id LIMIT 2)
      UNION ALL
      (SELECT request_id,'first_render',CASE WHEN $5 THEN 1 ELSE 3 END,1.0 FROM older
       WHERE quote_state='accepted' AND status='completed' AND ($6::text IS NULL OR surface=$6)
       ORDER BY created_at,request_id LIMIT 1)
      UNION ALL
      (SELECT request_id,'related',2,score FROM (
        SELECT request_id,created_at,ts_rank(to_tsvector('simple',concat_ws(' ',message,reply,model_id,direction)),
          to_tsquery('simple',NULLIF($7,''))) AS score FROM older
       ) matches WHERE score>0 ORDER BY score DESC,CASE WHEN $5 THEN created_at END,created_at DESC,request_id LIMIT 3)
      UNION ALL
      (SELECT request_id,'opening',CASE WHEN $5 THEN 2 ELSE 3 END,1.0 FROM older ORDER BY created_at,request_id LIMIT 1)
      UNION ALL
      (SELECT request_id,'recent',4,1.0 FROM older ORDER BY created_at DESC,request_id DESC LIMIT 1)
    ), picked AS (
      SELECT DISTINCT ON (request_id) * FROM choices ORDER BY request_id,priority,score DESC,reason
    ), selected AS (
      SELECT h.*,p.reason,p.priority,p.score FROM picked p JOIN older h USING(request_id)
      ORDER BY p.priority,p.score DESC,h.created_at,h.request_id LIMIT 5
    )
    SELECT s.request_id AS "requestId",s.created_at AS "createdAt",s.reason AS "selectedFor",s.message,s.reply,s.quote_id AS "quoteId",
      t.input_json->'references' AS "imageIds",t.input_json->'attachments' AS attachments,t.input_json->'referenceMentions' AS mentions,
      s.model_id AS "modelId",s.surface,q.request_json->>'mode' AS mode,
      COALESCE(NULLIF(q.request_json->>'prompt',''),q.request_json->'settings'->>'script',q.request_json->'settings'->>'lyrics') AS direction,q.request_json->'settings'->'multiPrompt' AS shots,
      (SELECT jsonb_object_agg(key,value) FROM jsonb_each(CASE WHEN jsonb_typeof(q.request_json->'settings')='object'
        THEN q.request_json->'settings' ELSE '{}'::jsonb END) WHERE key=ANY($8)) AS settings,
      q.request_json->'references' AS references,s.job_id AS "jobId",s.status,
      ARRAY(SELECT jsonb_build_object('type','job-output','jobId',o.job_id,'outputId',o.id,'kind',o.kind) FROM job_outputs o
        WHERE s.quote_state='accepted' AND s.status='completed' AND o.job_id=s.job_id AND o.user_id=$1
          AND o.status='ready' AND o.kind IN ('image','video','audio')
        ORDER BY (o.id=ANY($4)) DESC,(o.kind=s.surface) DESC,o.id LIMIT 3) AS outputs
    FROM selected s JOIN studio_image_turns t ON t.user_id=$1 AND t.project_id=$2 AND t.request_id=s.request_id
    LEFT JOIN mcp_generation_quotes q ON q.quote_id=s.quote_id
    ORDER BY s.priority,s.score DESC,s.created_at,s.request_id`,
    [actor.userId, actor.projectId, beforeRequestId, ids, first, surface, terms.join(' | '), STUDIO_QUOTE_SETTING_KEYS]);

  const result: StudioConversationArchiveEntry[] = [];
  for (const row of rows) {
    const attachments = projectAttachments(row);
    const render = projectRender(row, terms);
    const safeReply = row.reply && (row.quoteId ? projectStudioQuotedReply(row.reply, {message:row.message ?? ''}, row.direction) : projectStudioReply(row.reply));
    const reply = excerpt(safeReply, 360, terms);
    const entry = {requestId: row.requestId, createdAt: row.createdAt.toISOString(), selectedFor: row.selectedFor, message: excerpt(row.message, 480, terms),
      ...(attachments.length ? {attachments} : {}), ...(reply ? {reply} : {}), ...(render ? {render} : {})};
    if (JSON.stringify([...result, entry]).length <= maxArchiveChars) result.push(entry);
  }
  return result;
}

/** Sample changes across the full project, even for a follow-up with no search terms.
 * Only authored constraints enter these blocks. Later revisions stay in chronological order.
 */
export async function readStudioArchiveDecisions(actor: StudioGenerationActor, beforeRequestId: string) {
  requireGenerationActor(actor);
  if (actor.authMethod !== 'studio-session') throw new AgentApiError('AUTH_REQUIRED', 'Studio session required.');
  const signals = [
    'keep', 'always', 'never', 'only', 'must', 'without', 'instead', 'replace', 'remove', 'avoid', 'change', 'no longer',
    'do not', "don.t", 'continue with', 'use', 'switch to', 'from now on', 'make sure',
    'garde[rz]?', 'conserve[rz]?', 'utilise[rz]?', 'change[rz]?', 'toujours', 'jamais', 'uniquement', 'seulement', 'sans', 'remplace[rz]?', 'retire[rz]?',
    'évite[rz]?', 'désormais', 'dorénavant', 'plutôt', 'ne pas', 'il faut', 'on continue avec',
    'mant[eé]n', 'conserva', 'usa', 'utiliza', 'cambia', 'siempre', 'nunca', 'solo', 'solamente', 'sin', 'reemplaza', 'quita', 'evita', 'en vez', 'debe', 'a partir de ahora',
  ];
  const decisionExpression = '\\m(' + signals.join('|') + ')\\M';
  const rows = await query<{requestId: string; createdAt: Date; message: string; signal: string}>(`
    WITH candidates AS (
      SELECT t.request_id,t.created_at,t.input_json->>'message' AS message,
        substring(lower(t.input_json->>'message') FROM $4) AS signal
      FROM studio_image_turns t JOIN studio_projects p ON p.id=t.project_id AND p.user_id=t.user_id AND p.deleted_at IS NULL
      JOIN studio_image_turns boundary ON boundary.user_id=t.user_id AND boundary.project_id=t.project_id AND boundary.request_id=$3
      WHERE t.user_id=$1 AND t.project_id=$2 AND t.state='ready' AND (t.created_at,t.request_id)<(boundary.created_at,boundary.request_id)
    ), blocks AS (
      SELECT *,ntile(6) OVER (ORDER BY created_at,request_id) AS block FROM candidates WHERE signal IS NOT NULL
    )
    SELECT DISTINCT ON (block) request_id AS "requestId",created_at AS "createdAt",message,signal FROM blocks
    ORDER BY block,created_at DESC,request_id DESC`, [actor.userId, actor.projectId, beforeRequestId, decisionExpression]);
  return rows.map(row => ({requestId: row.requestId, createdAt: row.createdAt.toISOString(), message: excerpt(row.message, 260, [row.signal])}));
}
