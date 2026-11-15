const en = {
  UPSCALE_TARGET_NOT_LARGER: 'This video is already at or above the selected resolution. Choose a higher resolution or factor mode. You have not been charged.',
  TOOL_CONTENT_BLOCKED: 'The provider blocked this video during safety checks. Choose a different source video.',
  TOOL_OUTPUT_INVALID: 'The processed video did not preserve the requested dimensions, duration, frame rate or audio. Choose a different source video or processing method.',
  TOOL_OUTPUT_SAVE_FAILED: 'The video was processed, but its result could not be saved. Try again later or contact support.',
  TOOL_PROVIDER_FAILED: 'The provider could not process this video. Try a different source video or processing method.',
  TOOL_SUBMISSION_INTERRUPTED: 'The processing request was interrupted. Try again later or contact support.',
  TOOL_RUN_FAILED: 'This video could not be processed. Try a different source video or contact support.',
  TOOL_QUALIFICATION_REQUIRED: 'This processing method is temporarily unavailable. Choose another method.',
  TOOL_STORAGE_UNAVAILABLE: 'Saving results is temporarily unavailable. Try again later. You have not been charged.',
  QUOTE_CHANGED: 'The price changed. Review the new price before applying the tool.',
  INSUFFICIENT_FUNDS: 'Add funds to continue.',
  SOURCE_UNAVAILABLE: 'Choose an available video from Media or upload it again.',
  JOB_UNAVAILABLE: 'This processing job is no longer available. Check your Media and transaction history.',
};
export type ToolFailureCode = keyof typeof en;
const fr: Record<ToolFailureCode, string> = {
  UPSCALE_TARGET_NOT_LARGER: 'Cette vidéo atteint déjà la résolution choisie ou la dépasse. Choisissez une résolution supérieure ou le mode facteur. Aucun débit effectué.',
  TOOL_CONTENT_BLOCKED: 'Le fournisseur a bloqué cette vidéo lors de ses contrôles de sécurité. Choisissez une autre vidéo source.',
  TOOL_OUTPUT_INVALID: 'La vidéo traitée ne conserve pas les dimensions, la durée, la cadence ou le son demandés. Choisissez une autre vidéo source ou méthode de traitement.',
  TOOL_OUTPUT_SAVE_FAILED: 'La vidéo a été traitée, mais le résultat n’a pas pu être enregistré. Réessayez plus tard ou contactez le support.',
  TOOL_PROVIDER_FAILED: 'Le fournisseur n’a pas pu traiter cette vidéo. Essayez une autre vidéo source ou méthode de traitement.',
  TOOL_SUBMISSION_INTERRUPTED: 'La demande de traitement a été interrompue. Réessayez plus tard ou contactez le support.',
  TOOL_RUN_FAILED: 'Cette vidéo n’a pas pu être traitée. Essayez une autre vidéo source ou contactez le support.',
  TOOL_QUALIFICATION_REQUIRED: 'Cette méthode de traitement est temporairement indisponible. Choisissez une autre méthode.',
  TOOL_STORAGE_UNAVAILABLE: 'L’enregistrement des résultats est temporairement indisponible. Réessayez plus tard. Aucun débit effectué.',
  QUOTE_CHANGED: 'Le prix a changé. Vérifiez le nouveau prix avant d’appliquer l’outil.',
  INSUFFICIENT_FUNDS: 'Ajoutez des fonds pour continuer.',
  SOURCE_UNAVAILABLE: 'Choisissez une vidéo disponible dans Médias ou importez-la à nouveau.',
  JOB_UNAVAILABLE: 'Ce traitement n’est plus disponible. Consultez vos Médias et votre historique de transactions.',
};
const es: Record<ToolFailureCode, string> = {
  UPSCALE_TARGET_NOT_LARGER: 'El vídeo ya alcanza o supera la resolución elegida. Elige una resolución superior o el modo de factor. No se ha realizado ningún cargo.',
  TOOL_CONTENT_BLOCKED: 'El proveedor bloqueó este vídeo durante los controles de seguridad. Elige otro vídeo de origen.',
  TOOL_OUTPUT_INVALID: 'El vídeo procesado no conserva las dimensiones, la duración, los fotogramas o el audio solicitados. Elige otro vídeo o método de procesamiento.',
  TOOL_OUTPUT_SAVE_FAILED: 'El vídeo se procesó, pero no se pudo guardar el resultado. Inténtalo más tarde o contacta con soporte.',
  TOOL_PROVIDER_FAILED: 'El proveedor no pudo procesar este vídeo. Prueba otro vídeo o método de procesamiento.',
  TOOL_SUBMISSION_INTERRUPTED: 'Se interrumpió la solicitud de procesamiento. Inténtalo más tarde o contacta con soporte.',
  TOOL_RUN_FAILED: 'No se pudo procesar este vídeo. Prueba otro vídeo o contacta con soporte.',
  TOOL_QUALIFICATION_REQUIRED: 'Este método de procesamiento no está disponible temporalmente. Elige otro método.',
  TOOL_STORAGE_UNAVAILABLE: 'No se pueden guardar resultados temporalmente. Inténtalo más tarde. No se ha realizado ningún cargo.',
  QUOTE_CHANGED: 'El precio ha cambiado. Revisa el nuevo precio antes de aplicar la herramienta.',
  INSUFFICIENT_FUNDS: 'Añade fondos para continuar.',
  SOURCE_UNAVAILABLE: 'Elige un vídeo disponible en Medios o vuelve a subirlo.',
  JOB_UNAVAILABLE: 'Este procesamiento ya no está disponible. Consulta Medios y tu historial de transacciones.',
};
export function isToolFailureCode(value: unknown): value is ToolFailureCode {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(en, value);
}
export function toolFailureMessage(code: unknown, locale: string, refunded = false): string {
  const messages = locale === 'fr' ? fr : locale === 'es' ? es : en;
  const message = messages[isToolFailureCode(code) ? code : 'TOOL_RUN_FAILED'];
  return message + (refunded ? locale === 'fr' ? ' Le montant a été recrédité à votre portefeuille.' : locale === 'es' ? ' El importe se ha devuelto a tu monedero.' : ' The charge was refunded to your wallet.' : '');
}
