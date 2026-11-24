import { query, type TransactionQueryExecutor } from '@/lib/db';
import { studioReferenceLabel, studioReferenceOrdinal } from '@/lib/mobile-studio';
import { AgentApiError } from '@/server/agent-api/errors';
import type { ImageDraft, ImageTurnInput } from '@/lib/studio/image-conversation-contract';
import { studioTaskSchemaReady } from './tasks/repository';

type Project = { userId: string; projectId: string };
type Kind = 'image' | 'video' | 'audio';
export type StudioRecalledReference = { requestId: string; assetId: string; kind: Kind; label: string };
export type StoredStudioDraft = ImageDraft & { recalledReferences?: StudioRecalledReference[] };
export type StudioReferenceOrdinals = Record<Kind, number>;
const prefix = { image: 'Image', video: 'Video', audio: 'Audio' };

/** Preserve the label in the original submission. Old clients numbered each kind in send order. */
export function originalStudioReferences(input: ImageTurnInput, requestId: string): StudioRecalledReference[] {
  const counts: StudioReferenceOrdinals = { image: 0, video: 0, audio: 0 };
  const mentions = new Map(input.referenceMentions?.map((ref) => [ref.assetId, ref.label]));
  const items = [
    ...input.references.map((assetId) => ({ assetId, kind: 'image' as const })),
    ...(input.attachments ?? []).flatMap((ref) => (ref.type === 'asset' ? [ref] : [])),
  ];
  return items.map(({ assetId, kind }) => {
    const ordinal = ++counts[kind];
    return { requestId, assetId, kind, label: mentions.get(assetId) ?? prefix[kind] + ' ' + ordinal };
  });
}

async function originalEntries(beforeTurn: boolean, exactTurns = false, tasksReady?: boolean) {
  const selection = exactTurns ? 'AND t.request_id=ANY($4::uuid[])' : '';
  const before = beforeTurn ? 'AND (t.created_at,t.request_id) < (SELECT created_at,request_id FROM anchor)' : '';
  const tasks = tasksReady ?? await studioTaskSchemaReady();
  return `WITH anchor AS (
      SELECT created_at,request_id FROM studio_image_turns
      WHERE user_id=$1 AND project_id=$2 ${beforeTurn ? 'AND request_id=$3' : 'AND false'}
    ), inputs AS (
      SELECT t.request_id,t.input_json FROM studio_image_turns t
      WHERE t.user_id=$1 AND t.project_id=$2 ${before} ${selection}
      ${
        tasks
          ? `UNION ALL SELECT t.request_id,t.input_json FROM studio_tasks t
        WHERE t.user_id=$1 AND t.project_id=$2 ${before} ${selection}
          AND NOT EXISTS (SELECT 1 FROM studio_image_turns i WHERE i.user_id=t.user_id AND i.project_id=t.project_id
            AND i.request_id=t.request_id)`
          : ''
      }
    ), entries AS (
      SELECT i.request_id, r.asset_id, r.kind, COALESCE(m.label, initcap(r.kind)||' '||r.ordinal) AS label
      FROM inputs i
      CROSS JOIN LATERAL (
        SELECT image AS asset_id, 'image' AS kind, ordinal
        FROM jsonb_array_elements_text(i.input_json->'references') WITH ORDINALITY img(image,ordinal)
        UNION ALL
        SELECT attachment->>'assetId', attachment->>'kind', row_number() OVER (PARTITION BY attachment->>'kind' ORDER BY n)
        FROM jsonb_array_elements(i.input_json->'attachments') WITH ORDINALITY att(attachment,n)
        WHERE attachment->>'type'='asset' AND attachment->>'kind' IN ('video','audio')
      ) r
      LEFT JOIN LATERAL (
        SELECT mention->>'label' AS label FROM jsonb_array_elements(i.input_json->'referenceMentions') mention
        WHERE mention->>'assetId'=r.asset_id AND mention->>'label' ~ ('^'||initcap(r.kind)||' [1-9][0-9]{0,5}$') LIMIT 1
      ) m ON true
      WHERE r.asset_id ~ '^ma_[a-f0-9]{32}$'
        AND EXISTS (SELECT 1 FROM studio_projects p WHERE p.user_id=$1 AND p.id=$2 AND p.deleted_at IS NULL)
    )`;
}

export async function readStudioProjectReferenceOrdinals(actor: Project): Promise<StudioReferenceOrdinals> {
  const rows = await query<{ kind: Kind; maximum: number }>(
    `${await originalEntries(false)}
    SELECT kind,max(split_part(label,' ',2)::integer) AS maximum FROM entries GROUP BY kind`,
    [actor.userId, actor.projectId],
  );
  const ordinals = { image: 0, video: 0, audio: 0 };
  for (const row of rows) ordinals[row.kind] = row.maximum;
  return ordinals;
}

export type RegisteredStudioInput = ImageTurnInput & { referenceLabelChanges?: {from:string; to:string}[] };

/** Only the canonical message, attachments and labels participate in the worker's turn identity. */
export function registeredStudioMessage(registered: RegisteredStudioInput): ImageTurnInput {
  const input = {...registered};
  delete input.referenceLabelChanges;
  return input;
}

/** Called inside task admission, after acquiring the Studio account lock and checking replay identity. */
export async function registerStudioReferenceLabels(actor: Project, input: ImageTurnInput, tx: TransactionQueryExecutor): Promise<RegisteredStudioInput> {
  const refs = originalStudioReferences(input,input.requestId);
  if (!refs.length) return input;
  const rows = await tx.query<{
    kind:Kind; maximum:number; occupied:string[]; known:{assetId:string; label:string}[];
  }>(`${await originalEntries(false,false,true)}, labels AS (
    SELECT kind,label,split_part(label,' ',2)::int AS ordinal,count(DISTINCT asset_id) AS owners,min(asset_id) AS asset
    FROM entries GROUP BY kind,label
  ) SELECT kind,max(ordinal)::int AS maximum,
    coalesce(array_agg(label) FILTER (WHERE label=ANY($4::text[])),ARRAY[]::text[]) AS occupied,
    coalesce(jsonb_agg(jsonb_build_object('assetId',asset,'label',label) ORDER BY ordinal)
      FILTER (WHERE owners=1 AND asset=ANY($3::text[])),'[]'::jsonb) AS known
    FROM labels GROUP BY kind`,[actor.userId,actor.projectId,refs.map(ref=>ref.assetId),refs.map(ref=>ref.label)]);
  const maxima: StudioReferenceOrdinals = {image:0,video:0,audio:0};
  const known = new Map<string,string>();
  const occupied = new Set<string>();
  for (const row of rows) {
    maxima[row.kind] = row.maximum;
    for (const label of row.occupied) occupied.add(label);
    for (const binding of row.known) if (!known.has(binding.assetId)) known.set(binding.assetId,binding.label);
  }
  const changes: NonNullable<RegisteredStudioInput['referenceLabelChanges']> = [];
  const bindings = new Map(refs.map(ref => {
    let label = known.get(ref.assetId);
    if (!label) {
      const ordinal = Math.max(maxima[ref.kind]+1, studioReferenceOrdinal(ref.kind,ref.label));
      if (ordinal>999999) throw new AgentApiError('PARAMETER_INVALID','This project has reached its reference label limit.');
      maxima[ref.kind] = ordinal;
      label = studioReferenceLabel(ref.kind,ordinal);
    }
    if (ref.label !== label && occupied.has(ref.label)) changes.push({from:ref.label,to:label});
    occupied.add(label);
    return [ref.assetId,{assetId:ref.assetId,label}] as const;
  }));
  // The phone journal also uses the submitted mention order for mixed image, video and audio.
  const referenceMentions = (input.referenceMentions ?? []).map(({assetId}) => {
    const assigned = bindings.get(assetId)!;
    bindings.delete(assetId);
    return assigned;
  });
  referenceMentions.push(...bindings.values());
  return {...input,referenceMentions,...(changes.length ? {referenceLabelChanges:changes} : {})};
}

/** Two distinct files per requested label suffice to detect ambiguity across the whole project. */
export async function findStudioProjectReferences(actor: Project, before: string, labels: string[]) {
  return query<StudioRecalledReference>(
    `${await originalEntries(true)}, distinct_assets AS (
      SELECT DISTINCT ON (label,asset_id) label,asset_id,kind,request_id
      FROM entries WHERE label=ANY($4::text[]) ORDER BY label,asset_id,request_id
    ), ranked AS (
      SELECT *,row_number() OVER (PARTITION BY label ORDER BY asset_id) AS n FROM distinct_assets
    ) SELECT request_id AS "requestId", asset_id AS "assetId",label,kind FROM ranked WHERE n<=2`,
    [actor.userId, actor.projectId, before, labels],
  );
}

/** A natural reference to the project's one photo (or both photos) must be unique. */
export async function findStudioProjectReferencesByKind(actor: Project, before: string, kind: Kind) {
  return query<StudioRecalledReference>(
    `${await originalEntries(true)}, files AS (
      SELECT DISTINCT ON (asset_id) request_id,asset_id,kind,label,split_part(label,' ',2)::int AS ordinal
      FROM entries WHERE kind=$4 ORDER BY asset_id,ordinal,request_id
    ) SELECT request_id AS "requestId",asset_id AS "assetId",kind,label FROM files ORDER BY ordinal,asset_id LIMIT 3`,
    [actor.userId, actor.projectId, before, kind],
  );
}

/** Receipts identify origin turns. Recheck those exact immutable submissions before reusing any file. */
export async function projectStillContainsReferences(
  actor: Project,
  before: string,
  selected: StudioRecalledReference[],
) {
  const rows = await query<StudioRecalledReference>(
    `${await originalEntries(true, true)}
    SELECT DISTINCT request_id AS "requestId",asset_id AS "assetId",kind,label FROM entries`,
    [actor.userId, actor.projectId, before, [...new Set(selected.map((ref) => ref.requestId))]],
  );
  return selected.every((ref) =>
    rows.some(
      (row) =>
        row.requestId === ref.requestId &&
        row.assetId === ref.assetId &&
        row.kind === ref.kind &&
        row.label === ref.label,
    ),
  );
}
