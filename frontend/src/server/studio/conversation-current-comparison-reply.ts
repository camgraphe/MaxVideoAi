import type {StudioActionRequest,StudioActionResult} from '@/lib/studio/conversation-action-contract';
import type {GenerationPriceOption} from '@/server/agent-api/generation-price-comparison';
import {projectStudioReply} from '@/lib/studio/conversation-reply';
import type {ImageDraft} from '@/lib/studio/image-conversation-contract';
import {isStudioComparisonMismatch} from './conversation-comparison-recovery';

type Locale='en'|'fr'|'es';
const copy={
  en:{heading:'Current scenario estimates',scope:'Each video price is for one clip, not the whole film.',confirmation:'No quote or generation was created. Creation requires a fresh exact quote and your confirmation.',failed:'I could not verify compatible current prices.',constraints:'Requested requirements remain unchanged',duration:'No current option supports that duration as one clip. A supported clip plan still needs current pricing.',sound:'sound on',silent:'sound off',defaults:'default settings',baseline:'Current baseline',different:'settings differ from the baseline',saving:'lower than the baseline',missing:'Some requested options could not be priced.'},
  fr:{heading:'Estimations actuelles du scénario',scope:'Chaque prix vidéo concerne un clip, pas le film entier.',confirmation:'Aucun devis ni génération créé. La création exige un nouveau devis exact et votre confirmation.',failed:'Je ne peux pas vérifier les prix actuels compatibles.',constraints:'Les exigences demandées restent inchangées',duration:'Aucune option actuelle ne prend en charge cette durée en un seul clip. Un découpage compatible doit encore être chiffré.',sound:'son activé',silent:'son désactivé',defaults:'réglages par défaut',baseline:'Référence tarifaire actuelle',different:'réglages différents de la référence',saving:'de moins que la référence',missing:'Certaines options demandées ne peuvent pas être chiffrées.'},
  es:{heading:'Estimaciones actuales del escenario',scope:'Cada precio de vídeo corresponde a un clip, no a toda la película.',confirmation:'No se ha creado ningún presupuesto ni generación. La creación requiere un nuevo presupuesto exacto y tu confirmación.',failed:'No puedo verificar precios actuales compatibles.',constraints:'Los requisitos solicitados siguen intactos',duration:'Ninguna opción actual admite esa duración en un solo clip. Un plan de clips compatible todavía necesita precios actuales.',sound:'sonido activado',silent:'sonido desactivado',defaults:'ajustes predeterminados',baseline:'Referencia de precio actual',different:'ajustes diferentes de la referencia',saving:'menos que la referencia',missing:'No se pueden verificar los precios de algunas opciones solicitadas.'},
} as const;
const bounded=(value:string,length:number)=>value.length>length?value.slice(0,length-1)+'…':value;

function settingSummary(settings:Readonly<Record<string,string|number|boolean|null>>,locale:Locale,option?:GenerationPriceOption,maxLength=280):string {
  const words=copy[locale];
  const duration=option?.outputDurationSec??settings.durationSec;
  const sound=option?.audio==='always_generated'?true:option?.audio==='unavailable'?false:settings.audio;
  const parts=[typeof duration==='number'?`${duration}s`:null,settings.resolution,settings.aspectRatio,
    typeof sound==='boolean'?(sound?words.sound:words.silent):null,
    ...Object.entries(settings).filter(([name,value])=>!['durationSec','resolution','aspectRatio','audio'].includes(name)&&value!==null)
      .map(([name,value])=>`${name}: ${String(value).slice(0,80)}`),
  ].filter(value=>value!==null&&value!==undefined);
  return bounded(parts.join(', '),maxLength);
}

/** A terminal read exposes its canonical result without purchasing a follow-up Response. */
export function studioCurrentComparisonReply(request:Extract<StudioActionRequest,{action:'pricing.compare'}>,result:StudioActionResult,completedEdits:number,locale:Locale='en'):ImageDraft {
  const words=copy[locale];
  const saved=completedEdits?locale==='fr'?`${completedEdits} modification(s) de montage enregistrée(s). `
    :locale==='es'?`${completedEdits} cambio(s) guardado(s) en la línea de tiempo. `:`Saved ${completedEdits} timeline edit${completedEdits===1?'':'s'}. `:'';
  if(!result.ok){
    const constraints=settingSummary(Object.fromEntries(request.settings.map(({name,value})=>[name,value])),locale);
    const reason=isStudioComparisonMismatch(result)?words.duration:result.error.message.slice(0,480);
    return {image:null,continuation:{reason:'action_limit',completedEdits,lastError:{code:result.error.code,message:result.error.message.slice(0,800)}},
      reply:projectStudioReply(`${saved}${words.failed} ${words.constraints}${constraints?`: ${constraints}`:''}. ${reason} ${words.confirmation}`)};
  }
  if(result.action!=='pricing.compare')throw new Error('STUDIO_COMPARISON_RESULT_REQUIRED');
  const {data}=result;
  const options=data.options.slice(0,3).map(option=>{
    const notes=[option.savings?`${option.savings.percent}% ${words.saving}${option.savings.configurationDiffers?`; ${words.different}`:''}`:null,
      option.defaultedSettings.length?bounded(`${words.defaults}: ${option.defaultedSettings.join(', ')}`,100):null].filter(Boolean).join('; ');
    const title=`- ${bounded(option.modelLabel,80)}: ${option.price.formattedAmount}`;
    const summary=settingSummary(option.settings,locale,option,Math.min(280,Math.max(80,460-title.length-notes.length)));
    return `${title} (${summary})${notes?`. ${notes}`:''}`;
  });
  const baseline=data.baseline?bounded(`${words.baseline}: ${bounded(data.baseline.modelLabel,80)} ${data.baseline.price.formattedAmount} (${settingSummary(data.baseline.settings,locale,data.baseline)}).`,400):'';
  return {image:null,reply:projectStudioReply([
    `${saved}${words.heading} (${data.estimatedAt}). ${request.surface==='video'?words.scope:''} ${words.confirmation}`,
    ...options,baseline,data.unavailable.length||data.excludedCurrencies?.length?words.missing:'',
  ].filter(Boolean).join('\n'))};
}
