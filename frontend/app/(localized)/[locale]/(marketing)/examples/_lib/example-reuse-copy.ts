/** The public example is a starting point; its historic cost is not a new quote. */
export function getExampleReuseCopy(locale: string) {
  if (locale === 'fr') return {
    cta: 'Partir de cet exemple',
    hint: 'Reprenez le prompt et les réglages disponibles. Ajoutez vos propres références si nécessaire, puis vérifiez le prix avant de générer.',
  };
  if (locale === 'es') return {
    cta: 'Crear a partir de este ejemplo',
    hint: 'Reutiliza el prompt y los ajustes disponibles. Agrega tus propias referencias si hacen falta y revisa el precio antes de generar.',
  };
  return {
    cta: 'Start from this example',
    hint: 'Reuse the prompt and available settings. Add your own references if needed, then check the price before generating.',
  };
}
