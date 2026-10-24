/** The public example is a starting point; its historic cost is not a new quote. */
export function getExampleReuseCopy(locale: string) {
  if (locale === 'fr') return {
    cta: 'Partir de cet exemple',
    hint: "Reprenez le prompt et les réglages disponibles, fournissez vos propres sources admissibles puis vérifiez le devis actuel. Une copie publique ne donne ni la provenance Luma ni le cache Draft apparié d’un autre compte.",
  };
  if (locale === 'es') return {
    cta: 'Crear a partir de este ejemplo',
    hint: "Reutiliza el prompt y los ajustes disponibles, aporta tus propios orígenes elegibles y revisa la cotización actual. Una copia pública no da la procedencia Luma ni la caché Draft emparejada de otra cuenta.",
  };
  return {
    cta: 'Start from this example',
    hint: "Reuse the prompt and available settings, then supply your own eligible sources and review the current quote. Public video copies do not grant another account’s Luma generation lineage or paired Draft cache.",
  };
}
