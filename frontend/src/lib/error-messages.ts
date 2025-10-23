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

const FALLBACK_MESSAGE =
  'Unable to complete generation. Please try again in a few moments. If this keeps happening, contact support with your request ID.';

function normalizeCode(rawCode?: string | null): string | null {
  if (!rawCode) return null;
  return rawCode.trim().toUpperCase() || null;
}

function formatConstraintMessage(context: ErrorTranslationInput): string {
  const rawField = context.field ?? 'this option';
  const normalizedField =
    rawField === 'this option'
      ? 'this option'
      : rawField
          .replace(/([a-z])([A-Z])/g, '$1 $2')
          .replace(/[_-]+/g, ' ')
          .replace(/\b([a-z])/g, (match) => match.toUpperCase())
          .trim();
  const value =
    context.value == null || context.value === ''
      ? 'the selected value'
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
            if (typeof entry === 'boolean') return entry ? 'yes' : 'no';
            return null;
          })
          .filter((entry): entry is string => Boolean(entry))
      : null;
  if (allowedList && allowedList.length) {
    return `This engine does not support ${value} for ${normalizedField}. Supported values: ${allowedList.join(
      ', '
    )}. Please choose one of them and try again.`;
  }
  return `This engine does not support ${value} for ${normalizedField}. Please pick a different option and try again.`;
}

function formatQueueMessage(context: ErrorTranslationInput): string {
  if (typeof context.etaSeconds === 'number' && Number.isFinite(context.etaSeconds)) {
    const rounded = Math.max(1, Math.round(context.etaSeconds));
    return `The queue is temporarily busy. Please try again in ${rounded} s. Wait a moment and retry.`;
  }
  return 'The queue is temporarily busy. Please try again in a few seconds. Traffic is high; a short wait usually helps.';
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
    ENGINE_NOT_FOUND: () =>
      resolve('ENGINE_NOT_FOUND', 'Unknown or unavailable engine. Select a valid engine ID and try again.'),
    UNKNOWN_ENGINE: () =>
      resolve('ENGINE_NOT_FOUND', 'Unknown or unavailable engine. Select a valid engine ID and try again.'),
    ENGINE_CONSTRAINT: () => resolve('ENGINE_CONSTRAINT', formatConstraintMessage(context)),
    INSUFFICIENT_WALLET_FUNDS: () =>
      resolve(
        'INSUFFICIENT_WALLET_FUNDS',
        'Insufficient balance. Please add funds to continue. Top up your wallet or update your payment method, then try again.'
      ),
    INSUFFICIENT_FUNDS: () =>
      resolve(
        'INSUFFICIENT_FUNDS',
        'Insufficient balance. Please add funds to continue. Top up your wallet or update your payment method, then try again.'
      ),
    PROVIDER_BUSY: () => resolve('PROVIDER_BUSY', formatQueueMessage(context)),
    IN_PROGRESS: () => resolve('PROVIDER_BUSY', formatQueueMessage(context)),
    RATE_LIMITED: () => resolve('RATE_LIMITED', formatQueueMessage(context)),
    POLICY_VIOLATION: () =>
      resolve(
        'POLICY_VIOLATION',
        'The prompt violates our usage rules. Please modify your description. Remove prohibited content and try again.'
      ),
    SAFETY: () =>
      resolve(
        'SAFETY',
        'The prompt violates our usage rules. Please modify your description. Remove prohibited content and try again.'
      ),
    CONTENT_POLICY_VIOLATION: () =>
      resolve(
        'CONTENT_POLICY_VIOLATION',
        'The content could not be processed because it was flagged by a content checker. Remove prohibited content and try again.'
      ),
    CONTENT_FLAGGED: () =>
      resolve(
        'CONTENT_POLICY_VIOLATION',
        'The content could not be processed because it was flagged by a content checker. Remove prohibited content and try again.'
      ),
    FLAGGED_CONTENT: () =>
      resolve(
        'CONTENT_POLICY_VIOLATION',
        'The content could not be processed because it was flagged by a content checker. Remove prohibited content and try again.'
      ),
    FAL_UNPROCESSABLE_ENTITY: () =>
      resolve(
        'FAL_UNPROCESSABLE_ENTITY',
        originalMessage ??
          providerMessage ??
          'The request was rejected. Please verify your credentials and try again. Check your API key or account setup, then retry.'
      ),
    IMAGE_UNREACHABLE: () =>
      resolve(
        'IMAGE_UNREACHABLE',
        "Unable to access the provided image. Please check the link. Ensure the image URL is correct and publicly reachable, then retry."
      ),
    IMAGE_UPLOAD_FAILED: () =>
      resolve(
        'IMAGE_UPLOAD_FAILED',
        'Image upload failed. Please try with a different file. Try re-uploading, use a smaller file, or a common format (PNG/JPG).'
      ),
  };

  if (normalizedCode && mapByCode[normalizedCode]) {
    return mapByCode[normalizedCode]();
  }

  if (status === 402) {
    return resolve(
      'INSUFFICIENT_FUNDS',
      'Insufficient balance. Please add funds to continue. Top up your wallet or update your payment method, then try again.'
    );
  }
  if (status === 404) {
    return resolve('ENGINE_NOT_FOUND', 'Unknown or unavailable engine. Select a valid engine ID and try again.');
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
