import {toolAssetRefSchema,type ToolAssetRef} from '../../lib/toolbox/contract';
import {timelineExportManifestHash} from '../timeline-exports/estimate-token';
import {parseSubtitleDocument,editSubtitleDocument,subtitleEditSchema,type SubtitleDocument} from '../../lib/subtitles/document';
export type SubtitleExecutor={query:<T=Record<string,unknown>>(sql:string,params?:unknown[])=>Promise<T[]>};
export type SubtitleRepositoryDependencies=SubtitleExecutor&{transaction:<T>(run:(executor:SubtitleExecutor)=>Promise<T>)=>Promise<T>};
const defaultDependencies:SubtitleRepositoryDependencies={
  query:async(sql,params)=>(await import('@/lib/db')).query(sql,params),
  transaction:async run=>(await import('@/lib/db')).withDbTransaction(run),
};
function requireOwner(userId:string){if(!userId)throw new Error('UNAUTHORIZED');}
const requestHash=timelineExportManifestHash;
/** No schema bootstrap: migration 70 is explicit deployment ownership. */
export function createSubtitleRepository(dependencies:SubtitleRepositoryDependencies=defaultDependencies){
  async function read(userId:string,id:string,revision?:number):Promise<SubtitleDocument|null>{
    requireOwner(userId);
    if(revision!==undefined&&(!Number.isSafeInteger(revision)||revision<1))throw new Error('SUBTITLE_REVISION_INVALID');
    const rows=await dependencies.query<{document:unknown}>(`SELECT r.document FROM subtitle_documents d JOIN subtitle_document_revisions r
      ON r.document_id=d.id AND r.revision=COALESCE($3::integer,d.current_revision) WHERE d.id=$1 AND d.user_id=$2`,[id,userId,revision??null]);
    return rows[0]?parseSubtitleDocument(rows[0].document):null;
  }
  async function create(userId:string,value:SubtitleDocument,transcriptionJobId:string):Promise<SubtitleDocument>{
    requireOwner(userId);const document=parseSubtitleDocument(value);
    if(document.revision!==1||!transcriptionJobId||transcriptionJobId.length>256)throw new Error('SUBTITLE_CREATE_INVALID');
    return dependencies.transaction(async executor=>{
      await executor.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`subtitle:${document.id}`]);
      const previous=await executor.query<{user_id:string;document:unknown}>(`SELECT d.user_id,r.document FROM subtitle_documents d JOIN subtitle_document_revisions r ON r.document_id=d.id AND r.revision=1 WHERE d.id=$1`,[document.id]);
      if(previous[0]){
        if(previous[0].user_id!==userId||requestHash(previous[0].document)!==requestHash(document))throw new Error('SUBTITLE_CREATE_CONFLICT');
        return parseSubtitleDocument(previous[0].document);
      }
      await executor.query(`INSERT INTO subtitle_documents(id,user_id,current_revision,source_fingerprint,transcription_job_id) VALUES($1,$2,1,$3,$4)`,[document.id,userId,document.source.fingerprint,transcriptionJobId]);
      await executor.query(`INSERT INTO subtitle_document_revisions(document_id,revision,document) VALUES($1,1,$2::jsonb)`,[document.id,JSON.stringify(document)]);
      return document;
    });
  }
  async function update(userId:string,id:string,expectedRevision:number,requestId:string,change:unknown):Promise<SubtitleDocument>{
    requireOwner(userId);const edit=subtitleEditSchema.parse(change);
    if(!Number.isSafeInteger(expectedRevision)||expectedRevision<1||!requestId||requestId.length>200)throw new Error('SUBTITLE_UPDATE_INVALID');
    const fingerprint=requestHash({expectedRevision,edit});
    return dependencies.transaction(async executor=>{
      const current=await executor.query<{current_revision:number;document:unknown}>(`SELECT d.current_revision,r.document FROM subtitle_documents d JOIN subtitle_document_revisions r
        ON r.document_id=d.id AND r.revision=d.current_revision WHERE d.id=$1 AND d.user_id=$2 FOR UPDATE OF d`,[id,userId]);
      if(!current[0])throw new Error('SUBTITLE_NOT_FOUND');
      const receipt=await executor.query<{request_hash:string;document:unknown}>('SELECT request_hash,document FROM subtitle_document_revisions WHERE document_id=$1 AND request_id=$2',[id,requestId]);
      if(receipt[0]){if(receipt[0].request_hash!==fingerprint)throw new Error('SUBTITLE_REQUEST_CONFLICT');return parseSubtitleDocument(receipt[0].document);}
      if(current[0].current_revision!==expectedRevision)throw new Error('SUBTITLE_REVISION_CONFLICT');
      const next=parseSubtitleDocument({...editSubtitleDocument(parseSubtitleDocument(current[0].document),edit),revision:expectedRevision+1});
      await executor.query(`INSERT INTO subtitle_document_revisions(document_id,revision,document,request_id,request_hash) VALUES($1,$2,$3::jsonb,$4,$5)`,[id,next.revision,JSON.stringify(next),requestId,fingerprint]);
      await executor.query('UPDATE subtitle_documents SET current_revision=$3,updated_at=NOW() WHERE id=$1 AND user_id=$2',[id,userId,next.revision]);
      return next;
    });
  }
  async function list(userId:string,options:{source?:ToolAssetRef;limit?:number;sequenceId?:string;before?:{updatedAt:string;id:string}}={}){
    requireOwner(userId);const source=options.source?toolAssetRefSchema.parse(options.source):undefined;
    const limit=Math.max(1,Math.min(50,Number.isSafeInteger(options.limit)?options.limit!:20));
    const before=options.before;
    if(options.sequenceId&&options.sequenceId.length>200)throw new Error('SUBTITLE_CURSOR_INVALID');
    if(before&&(!before.id||before.id.length>200||!Number.isFinite(Date.parse(before.updatedAt))))throw new Error('SUBTITLE_CURSOR_INVALID');
    const rows=await dependencies.query<{id:string;current_revision:number;updated_at:Date|string;source:SubtitleDocument['source'];language:string;segment_count:number;excerpt:string}>(`SELECT d.id,d.current_revision,d.updated_at,r.document->'source' AS source,r.document->>'language' AS language,jsonb_array_length(r.document->'segments') AS segment_count,LEFT(r.document->'segments'->0->>'text',120) AS excerpt FROM subtitle_documents d JOIN subtitle_document_revisions r ON r.document_id=d.id AND r.revision=d.current_revision WHERE d.user_id=$1 AND ($2::jsonb IS NULL OR r.document->'source'->'ref'=$2::jsonb) AND ($4::timestamptz IS NULL OR (d.updated_at,d.id)<($4::timestamptz,$5::text)) AND ($6::text IS NULL OR r.document->'source'->'sequenceMix'->>'sequenceId'=$6) ORDER BY d.updated_at DESC,d.id DESC LIMIT $3`,[userId,source?JSON.stringify(source):null,limit,before?.updatedAt??null,before?.id??null,options.sequenceId??null]);
    return rows.map(row=>({id:row.id,revision:row.current_revision,language:row.language,segmentCount:row.segment_count,source:row.source,excerpt:row.excerpt??'',updatedAt:new Date(row.updated_at).toISOString(),durationMs:row.source.durationMs}));
  }
  return {read,create,update,list};
}
export const subtitleRepository=createSubtitleRepository();
