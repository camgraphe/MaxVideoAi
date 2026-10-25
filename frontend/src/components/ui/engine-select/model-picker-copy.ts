const en = {
  title: 'Choose a model', selected: 'Our selection', all: 'All models', search: 'Search models', clear: 'Clear search', close: 'Close model picker',
  quality: 'Quality first', balanced: 'Good balance', budget: 'Small budget', current: 'Current', use: 'Use', choose: 'Choose', info: 'About',
  back: 'Back to models', confirm: 'Confirm settings', before: 'Before applying', settings: 'This model uses different settings. Your prompt and references are kept.',
  estimate: 'Estimate with these settings', priceNote: 'Estimates in USD. The final price is checked before generation.', pending: 'Estimating…', error: 'Price unavailable', retry: 'Retry prices',
  model: 'model', models: 'models', family: 'family', families: 'families', empty: 'No matching model', loading: 'Preparing options…', unavailable: 'Unavailable for this operation',
  preserved: 'Applied only after confirmation.', changes: 'Settings to confirm', legacy: 'Older models', adjusted: 'Uses', supported: 'Supported operations', resolutions: 'Resolutions',
};
const fr: typeof en = {
  title: 'Choisir un modèle', selected: 'Notre sélection', all: 'Tous les modèles', search: 'Rechercher un modèle', clear: 'Effacer la recherche', close: 'Fermer le choix de modèle',
  quality: 'Qualité en priorité', balanced: 'Bon équilibre', budget: 'Petit budget', current: 'Actuel', use: 'Utiliser', choose: 'Choisir', info: 'Informations sur',
  back: 'Revenir aux modèles', confirm: 'Confirmer les réglages', before: 'Avant d’appliquer', settings: 'Ce modèle utilise d’autres réglages. Votre description et vos références sont conservées.',
  estimate: 'Estimation avec ces réglages', priceNote: 'Estimations en USD. Le prix final est vérifié avant génération.', pending: 'Estimation…', error: 'Prix indisponible', retry: 'Réessayer les prix',
  model: 'modèle', models: 'modèles', family: 'famille', families: 'familles', empty: 'Aucun modèle correspondant', loading: 'Préparation des options…', unavailable: 'Indisponible pour cette opération',
  preserved: 'Choix appliqué uniquement après confirmation.', changes: 'Réglages à confirmer', legacy: 'Anciens modèles', adjusted: 'Avec', supported: 'Opérations disponibles', resolutions: 'Résolutions',
};
const es: typeof en = {
  title: 'Elegir un modelo', selected: 'Nuestra selección', all: 'Todos los modelos', search: 'Buscar modelos', clear: 'Borrar búsqueda', close: 'Cerrar selector',
  quality: 'Prioridad a la calidad', balanced: 'Buen equilibrio', budget: 'Presupuesto reducido', current: 'Actual', use: 'Usar', choose: 'Elegir', info: 'Información sobre',
  back: 'Volver a los modelos', confirm: 'Confirmar ajustes', before: 'Antes de aplicar', settings: 'Este modelo utiliza otros ajustes. Se conservan tu descripción y tus referencias.',
  estimate: 'Estimación con estos ajustes', priceNote: 'Estimaciones en USD. Se verifica el precio final antes de generar.', pending: 'Estimando…', error: 'Precio no disponible', retry: 'Reintentar precios',
  model: 'modelo', models: 'modelos', family: 'familia', families: 'familias', empty: 'Ningún modelo coincide', loading: 'Preparando opciones…', unavailable: 'No disponible para esta operación',
  preserved: 'Se aplica solo después de confirmar.', changes: 'Ajustes por confirmar', legacy: 'Modelos anteriores', adjusted: 'Con', supported: 'Operaciones disponibles', resolutions: 'Resoluciones',
};
export function modelPickerCopy(locale: string) { return locale.startsWith('fr') ? fr : locale.startsWith('es') ? es : en; }
export type ModelPickerCopy = typeof en;
