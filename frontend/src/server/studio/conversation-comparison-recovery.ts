import {createHash} from 'node:crypto';
import type {AgentApiFailure} from '@/server/agent-api/errors';
import {stableJson} from '@/server/agent-api/generation-normalization';
import {projectStudioReply} from '@/lib/studio/conversation-reply';
import type {StudioActionResult} from '@/lib/studio/conversation-action-contract';

type ComparisonFailure=AgentApiFailure & {action:'pricing.compare'};
const record=(value:unknown):Record<string,unknown>=>value!==null&&typeof value==='object'?value as Record<string,unknown>:{};

/** Only a proven unsupported single-clip duration is independent of prompt/pricing availability. */
export function isStudioComparisonMismatch(value:unknown):value is ComparisonFailure {
  const result=record(value),error=record(result.error),next=record(error.nextAction);
  return result.ok===false&&result.action==='pricing.compare'&&error.code==='PARAMETER_INVALID'&&error.retryable===false
    &&typeof error.message==='string'&&next.type==='generation_comparison'&&next.reason==='no_matching_scenario'
    &&next.durationMismatch===true&&typeof next.requestedDurationSec==='number'&&Number.isFinite(next.requestedDurationSec)&&next.requestedDurationSec>0;
}

/** Used only for proven duration mismatches; rephrasing cannot change that constraint. */
export function studioComparisonFingerprint(value:unknown):string|null {
  const action=record(value);
  if(action.action!=='pricing.compare'||!Array.isArray(action.settings)||!Array.isArray(action.references))return null;
  const settings=[...action.settings].map(value=>record(value)).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
  return createHash('sha256').update(stableJson({surface:action.surface,mode:action.mode,settings,references:action.references,
    baselineModelId:action.baselineModelId??null,baselineSettings:action.baselineSettings??null,
    candidateModelIds:Array.isArray(action.candidateModelIds)?[...action.candidateModelIds].sort():null,outputCount:action.outputCount})).digest('hex');
}

/** Stop a known repeated failure without another continuation/credit loop; useful montage tools stay available otherwise. */
export function studioRepeatedComparisonReply(failure:ComparisonFailure,completedEdits:number,locale?:'en'|'fr'|'es') {
  const saved=completedEdits?`Saved ${completedEdits} timeline edit${completedEdits===1?'':'s'}. `:'';
  const guidance=locale==='fr'
    ? 'Cette comparaison a déjà échoué avec les mêmes contraintes. Je ne la relance pas. Le film reste à terminer : il faut préparer des clips compatibles et la voix off, puis assembler les médias prêts. Chaque création conserve sa confirmation de devis.'
    :locale==='es'
      ? 'Esta comparación ya falló con las mismas restricciones. No la repetiré. La película sigue pendiente: prepara clips compatibles y la narración, y monta los medios listos. Cada creación requiere confirmar su presupuesto.'
      : 'This comparison already failed with the same constraints, so I am not repeating it. The film remains unfinished: use supported component clips and scripted narration, then assemble the ready media. Each creation still needs its quote confirmation.';
  return {reply:projectStudioReply(saved+failure.error.message.slice(0,800)+' '+guidance),image:null};
}

/** A recovered unprocessed read can refresh facts, but cannot purchase another Response. */
export function studioRecoveredComparisonReply(result:StudioActionResult,completedEdits:number,locale?:'en'|'fr'|'es') {
  const saved=completedEdits?`Saved ${completedEdits} timeline edit${completedEdits===1?'':'s'}. `:'';
  const facts=result.ok&&result.action==='pricing.compare'
    ? result.data.options.map(option=>`${option.modelLabel}: ${option.price.formattedAmount}${option.outputDurationSec?` (${option.outputDurationSec}s)`:''}`).join('; ')
    :!result.ok?`${result.error.code}: ${result.error.message.slice(0,800)}`:'No compatible price was recovered.';
  const guidance=locale==='fr'
    ? 'Comparaison récupérée sans nouvel appel d’assistance. Cette comparaison concerne un clip ; le film et la narration restent à terminer. La création nécessite un devis exact et sa confirmation.'
    :locale==='es'?'Comparación recuperada sin otra llamada de asistencia. Esta comparación corresponde a un clip; la película y la narración siguen pendientes. Cada creación requiere un presupuesto exacto confirmado.'
    :'Recovered the comparison without another assistance call. This comparison concerns one clip; the film and narration remain unfinished. Creation still requires an exact quote and its confirmation.';
  return {reply:projectStudioReply(saved+guidance+' '+facts),image:null};
}
