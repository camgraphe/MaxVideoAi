type Primitive = string | number | boolean | null | undefined;

export type ErrorTranslationInput = {
  code?: string | null;
  status?: number | null;
  message?: string | null;
  providerMessage?: string | null;
  field?: string | null;
  value?: Primitive;
  allowed?: Primitive[] | null;
  etaSeconds?: number | null;
};

export type TranslatedError = {
  code: string;
  message: string;
  originalMessage?: string | null;
  providerMessage?: string | null;
};

const FALLBACK_MESSAGE = 'Impossible de finaliser la generation. Reessayez dans quelques instants.';

function normalizeCode(rawCode?: string | null): string | null {
  if (!rawCode) return null;
  return rawCode.trim().toUpperCase() || null;
}

function formatConstraintMessage(context: ErrorTranslationInput): string {
  const field = context.field ?? 'cette option';
  const value =
    context.value == null || context.value === ''
      ? 'valeur fournie'
      : typeof context.value === 'string'
        ? context.value
        : String(context.value);
  const allowedList =
    context.allowed && context.allowed.length
      ? context.allowed
          .map((entry) => {
            if (entry == null) return null;
            if (typeof entry === 'string') return entry;
            if (typeof entry === 'number') return String(entry);
            if (typeof entry === 'boolean') return entry ? 'oui' : 'non';
            return null;
          })
          .filter((entry): entry is string => Boolean(entry))
      : null;
  if (allowedList && allowedList.length) {
    return `Cet engine ne supporte pas ${field}=${value}. Options: ${allowedList.join(', ')}.`;
  }
  return `Cet engine ne supporte pas ${field}=${value}.`;
}

function formatQueueMessage(context: ErrorTranslationInput): string {
  if (typeof context.etaSeconds === 'number' && Number.isFinite(context.etaSeconds)) {
    const rounded = Math.max(1, Math.round(context.etaSeconds));
    return `La file est temporairement chargee. Reessayez dans ${rounded} s.`;
  }
  return 'La file est temporairement chargee. Reessayez dans quelques secondes.';
}

export function translateError(context: ErrorTranslationInput): TranslatedError {
  const normalizedCode = normalizeCode(context.code);
  const status = context.status ?? null;
  const providerMessage = context.providerMessage ?? null;
  const originalMessage = context.message ?? null;

  const resolve = (code: string, message: string): TranslatedError => ({
    code,
    message,
    originalMessage,
    providerMessage,
  });

  const mapByCode: Record<string, () => TranslatedError> = {
    ENGINE_NOT_FOUND: () => resolve('ENGINE_NOT_FOUND', 'Moteur inconnu ou non disponible.'),
    UNKNOWN_ENGINE: () => resolve('ENGINE_NOT_FOUND', 'Moteur inconnu ou non disponible.'),
    ENGINE_CONSTRAINT: () => resolve('ENGINE_CONSTRAINT', formatConstraintMessage(context)),
    INSUFFICIENT_WALLET_FUNDS: () =>
      resolve('INSUFFICIENT_WALLET_FUNDS', 'Solde insuffisant. Ajoutez des fonds pour continuer.'),
    INSUFFICIENT_FUNDS: () =>
      resolve('INSUFFICIENT_FUNDS', 'Solde insuffisant. Ajoutez des fonds pour continuer.'),
    PROVIDER_BUSY: () => resolve('PROVIDER_BUSY', formatQueueMessage(context)),
    IN_PROGRESS: () => resolve('PROVIDER_BUSY', formatQueueMessage(context)),
    RATE_LIMITED: () => resolve('RATE_LIMITED', formatQueueMessage(context)),
    POLICY_VIOLATION: () =>
      resolve('POLICY_VIOLATION', 'Le prompt enfreint les regles. Modifiez votre description.'),
    SAFETY: () => resolve('SAFETY', 'Le prompt enfreint les regles. Modifiez votre description.'),
    FAL_UNPROCESSABLE_ENTITY: () =>
      resolve(
        'FAL_UNPROCESSABLE_ENTITY',
        originalMessage ??
          providerMessage ??
          'Le fournisseur a rejete la requete. Verifiez vos references et reessayez.'
      ),
    IMAGE_UNREACHABLE: () =>
      resolve('IMAGE_UNREACHABLE', "Impossible d'acceder a l'image fournie. Verifiez le lien."),
    IMAGE_UPLOAD_FAILED: () =>
      resolve('IMAGE_UPLOAD_FAILED', "Echec de l'upload de l'image. Reessayez avec un autre fichier."),
  };

  if (normalizedCode && mapByCode[normalizedCode]) {
    return mapByCode[normalizedCode]();
  }

  if (status === 402) {
    return resolve('INSUFFICIENT_FUNDS', 'Solde insuffisant. Ajoutez des fonds pour continuer.');
  }
  if (status === 404) {
    return resolve('ENGINE_NOT_FOUND', 'Moteur inconnu ou non disponible.');
  }
  if (status === 429) {
    return resolve('RATE_LIMITED', formatQueueMessage(context));
  }
  if (status === 503 || status === 504) {
    return resolve('PROVIDER_BUSY', formatQueueMessage(context));
  }

  if (normalizedCode) {
    return resolve(normalizedCode, originalMessage ?? providerMessage ?? FALLBACK_MESSAGE);
  }

  return resolve('UNKNOWN_ERROR', originalMessage ?? providerMessage ?? FALLBACK_MESSAGE);
}
