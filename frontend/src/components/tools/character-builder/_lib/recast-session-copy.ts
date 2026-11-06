const en = {
  newScene: 'New scene', reset: 'Start a new scene? This clears the current references, passages, text and quote. Saved characters and videos are kept.',
  restored: 'Your Recast scene was restored on this device. Review a fresh price before generating.',
  storageError: 'This scene could not be saved on this device. Keep this page open or download the shot brief before leaving.',
  leave: 'This scene is not saved yet, or its generation confirmation is unresolved. Leave this page anyway?',
  loading: 'Restoring your Recast scene…', settings: 'Output settings', quoteDetails: 'Quote details',
};
const fr: typeof en = {
  newScene: 'Nouvelle scène', reset: 'Commencer une nouvelle scène ? Les références, passages, textes et devis actuels seront effacés. Tes personnages et vidéos enregistrés sont conservés.',
  restored: 'Ta scène Recast a été restaurée sur cet appareil. Vérifie un nouveau prix avant de générer.',
  storageError: 'Impossible de sauvegarder cette scène sur cet appareil. Garde cette page ouverte ou télécharge la fiche de tournage avant de quitter.',
  leave: 'Cette scène n’est pas encore sauvegardée, ou sa confirmation de génération est incertaine. Quitter quand même ?',
  loading: 'Restauration de ta scène Recast…', settings: 'Réglages de sortie', quoteDetails: 'Détail du devis',
};
const es: typeof en = {
  newScene: 'Nueva escena', reset: '¿Empezar una nueva escena? Se borrarán las referencias, fragmentos, textos y presupuesto actuales. Se conservan tus personajes y vídeos guardados.',
  restored: 'Tu escena Recast se ha restaurado en este dispositivo. Revisa un precio nuevo antes de generar.',
  storageError: 'No se pudo guardar esta escena en este dispositivo. Mantén la página abierta o descarga la ficha de rodaje antes de salir.',
  leave: 'Esta escena aún no está guardada o su confirmación de generación es incierta. ¿Salir de todos modos?',
  loading: 'Restaurando tu escena Recast…', settings: 'Ajustes de salida', quoteDetails: 'Detalle del presupuesto',
};
export const getRecastSessionCopy = (locale: string) => locale.startsWith('fr') ? fr : locale.startsWith('es') ? es : en;
