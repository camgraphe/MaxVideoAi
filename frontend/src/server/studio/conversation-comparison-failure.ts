import type {StudioActionRequest,StudioActionResult} from '@/lib/studio/conversation-action-contract';
import {projectStudioReply} from '@/lib/studio/conversation-reply';

type Locale='en'|'fr'|'es';
const copy={
  en:{unverified:'The comparison could not establish a price. The available facts do not yet show which setting, if any, needs changing.',failed:'I could not verify a compatible price for this selection.',reference:'Select the intended media in the media shelf; they will stay selected for your next messages. If one is unavailable, choose another saved item.',multiple:'Should these images guide the same shot together, or each start a separate shot? I need that choice to use the right reference mode.',settings:'The requested settings do not fit the available options. Choose which matters most to keep: the source, duration or framing; I can then propose a compatible option with the difference explained.',outage:'Current pricing is unavailable. Keep this brief and check again when pricing is available.',end:'No generation quote or media was created. Any creation still needs your exact quote confirmation.'},
  fr:{unverified:'La comparaison n’a pas permis de vérifier un prix. Les faits disponibles ne permettent pas encore de dire quels réglages doivent éventuellement changer.',failed:'Je n’ai pas pu vérifier un prix compatible avec cette sélection.',reference:'Sélectionnez les médias voulus dans le panneau Médias ; ils resteront sélectionnés pour les messages suivants. Si un média est indisponible, choisissez un autre élément enregistré.',multiple:'Ces images doivent-elles guider un même plan ensemble, ou ouvrir chacune un plan distinct ? Ce choix permet de sélectionner le bon mode de référence.',settings:'Les réglages demandés ne correspondent pas aux options disponibles. Quelle priorité conserver : la source, la durée ou le cadrage ? Je pourrai proposer une option compatible en expliquant la différence.',outage:'Les prix actuels sont indisponibles. Conservez ce brief et vérifiez à nouveau lorsque les prix seront disponibles.',end:'Aucun devis de génération ni média créé. Toute création exige encore votre confirmation du devis exact.'},
  es:{unverified:'La comparación no ha permitido verificar un precio. Los datos disponibles todavía no indican qué ajustes, si los hay, necesitan cambiar.',failed:'No he podido verificar un precio compatible con esta selección.',reference:'Selecciona los medios que quieres usar en el panel de medios; seguirán seleccionados para los siguientes mensajes. Si uno no está disponible, elige otro archivo guardado.',multiple:'¿Estas imágenes deben guiar juntas un mismo plano, o iniciar cada una un plano distinto? Necesito esa elección para seleccionar el modo de referencia adecuado.',settings:'Los ajustes solicitados no encajan con las opciones disponibles. ¿Qué es prioritario conservar: el archivo original, la duración o el encuadre? Podré proponer una opción compatible explicando la diferencia.',outage:'Los precios actuales no están disponibles. Conserva este encargo y vuelve a comprobarlos cuando estén disponibles.',end:'No se ha creado ningún presupuesto de generación ni archivo multimedia. Cualquier creación requiere tu confirmación del presupuesto exacto.'},
} as const;

export function studioComparisonFailureGuidance(request:Extract<StudioActionRequest,{action:'pricing.compare'}>,result:Extract<StudioActionResult,{ok:false}>,locale:Locale):string {
  const words=copy[locale];
  if(result.error.code==='REFERENCE_INVALID'||result.error.code==='REFERENCE_REQUIRED')return words.reference;
  if(result.error.retryable||result.error.code==='ENGINE_UNAVAILABLE'||result.error.code==='INTERNAL_ERROR')return words.outage;
  const next=result.error.nextAction;
  if(next?.type==='generation_comparison'&&next.constraintMismatch!==true&&next.durationMismatch!==true)return words.unverified;
  return request.mode==='i2v'&&request.references.length>1&&request.references.every(ref=>ref.role==='reference')?words.multiple:words.settings;
}

export function studioFailedFilmComparisonReply(request:Extract<StudioActionRequest,{action:'pricing.compare'}>,result:Extract<StudioActionResult,{ok:false}>,locale:Locale) {
  const words=copy[locale];
  return {image:null,reply:projectStudioReply(`${words.failed} ${studioComparisonFailureGuidance(request,result,locale)} ${words.end}`)};
}
