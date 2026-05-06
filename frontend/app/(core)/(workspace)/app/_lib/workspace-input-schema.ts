import type {
  AssetFieldConfig,
  AssetFieldRole,
  ComposerPromotedAction,
} from '@/components/Composer';
import { localizeLtxField } from '@/lib/ltx-localization';
import type { EngineCaps, EngineInputField, Mode } from '@/types/engines';
import {
  normalizeFieldId,
  parseBooleanInput,
  PROMOTED_WORKFLOW_FIELD_IDS,
  STANDARD_ENGINE_FIELD_IDS,
} from './workspace-engine-helpers';
import type { FormState } from './workspace-form-state';

export type WorkspaceInputFieldEntry = {
  field: EngineInputField;
  required: boolean;
};

export type WorkspaceInputSchemaSummary = {
  assetFields: AssetFieldConfig[];
  promotedFields: WorkspaceInputFieldEntry[];
  secondaryFields: WorkspaceInputFieldEntry[];
  promptField?: EngineInputField;
  promptRequired: boolean;
  negativePromptField?: EngineInputField;
  negativePromptRequired: boolean;
};

export function resolveAssetFieldRole(field: EngineInputField, required: boolean): AssetFieldRole {
  const id = (field.id ?? '').toLowerCase();
  if (id.includes('first_frame') || id.includes('last_frame') || id.includes('end_image')) return 'frame';
  if (id === 'image_urls' || id.endsWith('_image_urls')) return 'reference';
  if (id === 'video_urls' || id.endsWith('_video_urls')) return 'reference';
  if (id === 'audio_urls' || id.endsWith('_audio_urls')) return 'reference';
  if (id.includes('reference')) return 'reference';
  if (id === 'image_url' || id === 'input_image') return 'primary';
  if (required && field.type === 'image') return 'primary';
  if (field.type === 'image') return 'reference';
  return 'generic';
}

export function summarizeWorkspaceInputSchema({
  selectedEngine,
  activeMode,
  allowsUnifiedVeoFirstLast,
  isUnifiedHappyHorse,
  isUnifiedSeedance,
  uiLocale,
}: {
  selectedEngine: EngineCaps | null;
  activeMode: Mode;
  allowsUnifiedVeoFirstLast: boolean;
  isUnifiedHappyHorse: boolean;
  isUnifiedSeedance: boolean;
  uiLocale: string;
}): WorkspaceInputSchemaSummary {
  const schema = selectedEngine?.inputSchema;
  if (!schema) {
    return {
      assetFields: [],
      promotedFields: [],
      secondaryFields: [],
      promptField: undefined,
      promptRequired: true,
      negativePromptField: undefined,
      negativePromptRequired: false,
    };
  }

  const allowsCrossModeAssets =
    activeMode === 't2v' &&
    Boolean(
      selectedEngine?.modes?.some(
        (mode) => mode === 'i2v' || mode === 'v2v' || mode === 'reframe' || mode === 'r2v' || mode === 'a2v'
      )
    );
  const appliesToMode = (field: EngineInputField) => {
    if (!field.modes || field.modes.includes(activeMode)) return true;
    if (
      isUnifiedSeedance &&
      (field.type === 'image' || field.type === 'video' || field.type === 'audio') &&
      (field.modes.includes('i2v') || field.modes.includes('ref2v'))
    ) {
      return true;
    }
    if (
      isUnifiedHappyHorse &&
      activeMode === 't2v' &&
      (field.type === 'image' || field.type === 'video') &&
      (field.modes.includes('i2v') || field.modes.includes('ref2v') || field.modes.includes('v2v'))
    ) {
      return true;
    }
    if (allowsUnifiedVeoFirstLast && field.id === 'last_frame_url' && field.modes.includes('fl2v')) return true;
    if (allowsUnifiedVeoFirstLast && field.id === 'first_frame_url' && field.modes.includes('fl2v')) return false;
    if (!allowsCrossModeAssets) return false;
    if (field.type === 'image' && field.modes.includes('i2v')) return true;
    if (
      field.type === 'video' &&
      (field.modes.includes('r2v') || field.modes.includes('v2v') || field.modes.includes('reframe'))
    ) {
      return true;
    }
    if (field.type === 'audio' && field.modes.includes('a2v')) return true;
    return false;
  };
  const isRequired = (field: EngineInputField, origin: 'required' | 'optional') => {
    if (field.requiredInModes) {
      return field.requiredInModes.includes(activeMode);
    }
    return origin === 'required';
  };

  const assetFields: AssetFieldConfig[] = [];
  const promotedFields: WorkspaceInputFieldEntry[] = [];
  const secondaryFields: WorkspaceInputFieldEntry[] = [];
  let promptField: EngineInputField | undefined;
  let promptFieldOrigin: 'required' | 'optional' | undefined;
  let negativePromptField: EngineInputField | undefined;
  let negativePromptOrigin: 'required' | 'optional' | undefined;

  const ingest = (fields: EngineInputField[] | undefined, origin: 'required' | 'optional') => {
    if (!fields) return;
    fields.forEach((field) => {
      if (!appliesToMode(field)) return;
      const localizedField = localizeLtxField(field, uiLocale, selectedEngine?.id);
      const normalizedId = normalizeFieldId(localizedField.id);
      if (localizedField.type === 'text') {
        const normalizedIdValue = (localizedField.id ?? '').toLowerCase();
        const normalizedIdCompact = normalizedIdValue.replace(/[^a-z0-9]/g, '');
        const normalizedLabel = (localizedField.label ?? '').toLowerCase();
        const normalizedLabelCompact = normalizedLabel.replace(/\s+/g, '');
        const hasNegativePromptCue = (value: string) =>
          value.includes('negativeprompt') ||
          (value.includes('negative') && value.includes('prompt')) ||
          value.includes('negprompt');
        const isNegative =
          normalizedIdValue === 'negative_prompt' ||
          hasNegativePromptCue(normalizedIdCompact) ||
          normalizedLabel.includes('negative prompt') ||
          hasNegativePromptCue(normalizedLabelCompact);
        if (isNegative) {
          if (!negativePromptField) {
            negativePromptField = localizedField;
            negativePromptOrigin = origin;
          }
          return;
        }
        const isPrompt = normalizedIdValue === 'prompt';
        if (!promptField || isPrompt) {
          promptField = localizedField;
          promptFieldOrigin = origin;
        }
        return;
      }
      const required = isRequired(localizedField, origin);
      if (localizedField.type === 'image' || localizedField.type === 'video' || localizedField.type === 'audio') {
        const role = resolveAssetFieldRole(localizedField, required);
        assetFields.push({ field: localizedField, required, role });
        return;
      }
      if (!STANDARD_ENGINE_FIELD_IDS.has(normalizedId)) {
        const isPromotedBooleanToggle =
          PROMOTED_WORKFLOW_FIELD_IDS.has(normalizedId) &&
          localizedField.type === 'enum' &&
          Array.isArray(localizedField.values) &&
          localizedField.values.includes('true') &&
          localizedField.values.includes('false');
        if (isPromotedBooleanToggle) {
          promotedFields.push({ field: localizedField, required });
          return;
        }
        secondaryFields.push({ field: localizedField, required });
      }
    });
  };

  ingest(schema.required, 'required');
  ingest(schema.optional, 'optional');

  const promptRequired = promptField ? isRequired(promptField, promptFieldOrigin ?? 'optional') : true;
  const negativePromptRequired = negativePromptField
    ? isRequired(negativePromptField, negativePromptOrigin ?? 'optional')
    : false;

  return {
    assetFields,
    promotedFields,
    secondaryFields,
    promptField,
    promptRequired,
    negativePromptField,
    negativePromptRequired,
  };
}

export function buildComposerPromotedActions({
  form,
  promotedFields,
  uiLocale,
  onToggle,
}: {
  form: FormState | null | undefined;
  promotedFields: WorkspaceInputFieldEntry[];
  uiLocale: string;
  onToggle: (field: EngineInputField, value: string) => void;
}): ComposerPromotedAction[] {
  if (!form) return [];
  return promotedFields.map(({ field }) => {
    const normalizedId = normalizeFieldId(field.id);
    const currentValue = parseBooleanInput(form.extraInputValues[field.id] ?? field.default);
    const active = currentValue ?? false;
    const promotedCopy =
      normalizedId === 'enhanceprompt'
        ? uiLocale === 'fr'
          ? {
              label: 'Améliorer',
              tooltip: 'Réécrit le prompt avant envoi pour un résultat plus propre.',
            }
          : uiLocale === 'es'
            ? {
                label: 'Mejorar',
                tooltip: 'Reescribe el prompt antes de enviarlo para un resultado más limpio.',
              }
            : {
                label: 'Improve',
                tooltip: 'Rewrites your prompt before sending it for a cleaner result.',
              }
        : normalizedId === 'autofix'
          ? uiLocale === 'fr'
            ? {
                label: 'Corriger si bloqué',
                tooltip: 'Si le prompt est bloqué, réessaie automatiquement avec une version sûre.',
              }
            : uiLocale === 'es'
              ? {
                  label: 'Corregir si bloquea',
                  tooltip: 'Si el prompt es bloqueado, reintenta automáticamente con una versión segura.',
                }
              : {
                  label: 'Fix if blocked',
                  tooltip: 'If the prompt is blocked, retry automatically with a safe rewrite.',
                }
          : {
              label: field.label,
              tooltip: field.description ?? field.label,
            };
    return {
      id: field.id,
      label: promotedCopy.label,
      tooltip: promotedCopy.tooltip,
      active,
      icon: normalizedId === 'autofix' ? 'shield' : 'sparkles',
      onToggle: () => onToggle(field, active ? 'false' : 'true'),
    };
  });
}
