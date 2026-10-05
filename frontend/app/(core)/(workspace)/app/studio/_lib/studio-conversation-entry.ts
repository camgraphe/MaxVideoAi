export function studioProjectEntryUrl(project: {id: string;persistenceMode?: string}, conversationEnabled = true): string {
  return conversationEnabled && project.persistenceMode === 'connected'
    ? `/app/studio/conversation/${encodeURIComponent(project.id)}`
    : '/app/studio';
}

const ENGLISH_ENTRY_COPY = {
  eyebrow: 'YOUR CREATIVE WORKSPACE',
  title: 'What would you like to create?',
  description: 'Explore an idea, shape a prompt, or create with your media. Start a conversation and take it as far as you need.',
  open: 'Open Studio',
  opening: 'Opening Studio…',
  retry: 'Try again',
  note: 'Review the price before you confirm any generation.',
  projectName: 'Untitled project',
  error: 'Studio could not confirm your project. Try again to recover the same project.',
  unauthorized: 'Please sign in again, then retry opening Studio.',
  unavailable: 'Studio is temporarily unavailable. Please try again.',
};

export function studioConversationEntryCopy(locale: string): typeof ENGLISH_ENTRY_COPY {
  if (locale !== 'fr') return ENGLISH_ENTRY_COPY;
  return {
    eyebrow: 'VOTRE ESPACE CRÉATIF',
    title: 'Qu’avez-vous envie de créer ?',
    description: 'Explorez une idée, affinez un prompt ou créez avec vos médias. Lancez une conversation et avancez à votre rythme.',
    open: 'Ouvrir Studio',
    opening: 'Ouverture de Studio…',
    retry: 'Réessayer',
    note: 'Vérifiez le prix avant de confirmer chaque génération.',
    projectName: 'Projet sans titre',
    error: 'Studio n’a pas pu confirmer votre projet. Réessayez pour retrouver le même projet.',
    unauthorized: 'Reconnectez-vous, puis réessayez d’ouvrir Studio.',
    unavailable: 'Studio est temporairement indisponible. Veuillez réessayer.',
  };
}
