export function generationActivityCopy(locale: string) {
  return locale === 'fr' ? {
    title: 'Générations en cours', close: 'Fermer la liste', empty: 'Aucune génération en cours',
    count: (count: number) => `${count} en cours`,
    open: (count: number) => count === 1 ? 'Afficher la génération en cours' : `Afficher les ${count} générations en cours`,
  } : locale === 'es' ? {
    title: 'Generaciones en curso', close: 'Cerrar la lista', empty: 'Ninguna generación en curso',
    count: (count: number) => `${count} en curso`,
    open: (count: number) => count === 1 ? 'Ver la generación en curso' : `Ver las ${count} generaciones en curso`,
  } : {
    title: 'Generations in progress', close: 'Close the list', empty: 'No generations in progress',
    count: (count: number) => `${count} in progress`,
    open: (count: number) => count === 1 ? 'View the generation in progress' : `View ${count} generations in progress`,
  };
}
