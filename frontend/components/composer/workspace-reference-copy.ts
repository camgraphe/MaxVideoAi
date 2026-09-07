export function workspaceReferenceCopy(locale: string) {
  return locale === 'fr' ? {
    title: 'Références', add: 'Ajouter des références', manage: 'Gérer', close: 'Fermer', replace: 'Remplacer', remove: 'Retirer', upload: 'Importer', library: 'Bibliothèque', required: 'Requis', details: 'Formats et conseils', options: 'Options', placeholder: 'Décrivez votre création…',
  } : locale === 'es' ? {
    title: 'Referencias', add: 'Añadir referencias', manage: 'Gestionar', close: 'Cerrar', replace: 'Reemplazar', remove: 'Quitar', upload: 'Subir', library: 'Biblioteca', required: 'Obligatorio', details: 'Formatos y consejos', options: 'Opciones', placeholder: 'Describe tu creación…',
  } : {
    title: 'References', add: 'Add references', manage: 'Manage', close: 'Close', replace: 'Replace', remove: 'Remove', upload: 'Upload', library: 'Library', required: 'Required', details: 'Formats and guidance', options: 'Options', placeholder: 'Describe your creation…',
  };
}
