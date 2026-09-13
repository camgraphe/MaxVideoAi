// Selection only: amounts are complete public quotes from the generated catalogue.
// No interpolation, price multiplication or reference-cost assumptions in this UI.
export function createModelChoices(catalogue) {
  const modelFor = choice => catalogue.models.find(m => m.id === choice.modelId);
  const initialModelChoice = () => ({ modelId: 'veo-3-1-fast', duration: 8, resolution: '1080p', format: '16:9', audio: true });
  function differences(model, choice) {
    const result = [];
    if (!model.durations.includes(choice.duration)) result.push('Durée');
    if (!model.resolutions.some(r => r.value === choice.resolution)) result.push('Résolution');
    if (!model.formats.includes(choice.format)) result.push('Format');
    if ((model.audio === 'included' && !choice.audio) || (model.audio === 'none' && choice.audio)) result.push('Son');
    return result;
  }
  function matchingQuote(choice, referenceCount = 0, missingSource = false) {
    const model = modelFor(choice);
    if (!model || referenceCount || missingSource || differences(model, choice).length) return null;
    return model.quotes.find(q => q.duration === choice.duration && q.resolution === choice.resolution && q.audio === choice.audio) || null;
  }
  function adaptChoice(model, previous) {
    return {
      modelId: model.id,
      duration: model.durations.includes(previous.duration) ? previous.duration : model.defaultDuration,
      resolution: model.resolutions.some(r => r.value === previous.resolution) ? previous.resolution : model.resolutions[0].value,
      format: model.formats.includes(previous.format) ? previous.format : model.formats[0],
      audio: model.audio === 'optional' ? previous.audio : model.audio === 'included',
    };
  }
  return { modelFor, initialModelChoice, differences, matchingQuote, adaptChoice };
}

export const money = quote => quote ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: quote.currency }).format(quote.totalCents / 100) : 'Devis à raccorder';
export const soundLabel = choice => choice.audio ? 'Avec son' : 'Sans son';
