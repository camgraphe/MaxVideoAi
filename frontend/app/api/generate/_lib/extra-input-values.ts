import type { EngineCaps, EngineInputField, Mode } from '@/types/engines';

type ExtraInputField = {
  id: string;
  type: Extract<EngineInputField['type'], 'text' | 'number' | 'enum'>;
  required: boolean;
  values?: Array<string | number>;
};

type ExtraInputValidationErrorBody = {
  ok: false;
  error: 'INVALID_EXTRA_FIELD' | 'MISSING_EXTRA_FIELD';
  field: string;
  message: string;
};

type ExtraInputValidationResult =
  | {
      ok: true;
      values: Record<string, unknown>;
    }
  | {
      ok: false;
      status: 400;
      body: ExtraInputValidationErrorBody;
    };

function normalizeFieldId(value: string | undefined): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

const STANDARD_INPUT_FIELD_IDS = new Set([
  'prompt',
  'negativeprompt',
  'duration',
  'durationseconds',
  'resolution',
  'aspectratio',
  'fps',
  'generateaudio',
  'seed',
  'camerafixed',
  'enablesafetychecker',
  'cfgscale',
  'loop',
]);

function getApplicableExtraInputFields(engine: Pick<EngineCaps, 'inputSchema'>, mode: Mode): ExtraInputField[] {
  const schema = engine.inputSchema;
  if (!schema) return [];

  return [...(schema.required ?? []), ...(schema.optional ?? [])]
    .filter((field) => !field.modes || field.modes.includes(mode))
    .filter(
      (field): field is EngineInputField & { type: 'text' | 'number' | 'enum' } =>
        field.type === 'text' || field.type === 'number' || field.type === 'enum'
    )
    .filter((field) => !STANDARD_INPUT_FIELD_IDS.has(normalizeFieldId(field.id)))
    .map((field) => ({
      id: field.id,
      type: field.type,
      required: Boolean(field.requiredInModes ? field.requiredInModes.includes(mode) : (schema.required ?? []).includes(field)),
      values: field.values,
    }));
}

export function validateExtraInputValues(params: {
  engine: Pick<EngineCaps, 'inputSchema'>;
  mode: Mode;
  rawExtraInputValues: Record<string, unknown> | null;
}): ExtraInputValidationResult {
  const applicableSchemaFields = getApplicableExtraInputFields(params.engine, params.mode);
  const applicableFieldMap = new Map(applicableSchemaFields.map((field) => [field.id, field]));
  const validatedExtraInputValues: Record<string, unknown> = {};

  if (params.rawExtraInputValues) {
    for (const [key, rawValue] of Object.entries(params.rawExtraInputValues)) {
      const schemaField = applicableFieldMap.get(key);
      if (!schemaField) {
        return {
          ok: false,
          status: 400,
          body: {
            ok: false,
            error: 'INVALID_EXTRA_FIELD',
            field: key,
            message: `Unsupported input field "${key}" for this mode.`,
          },
        };
      }

      if (schemaField.type === 'number') {
        const parsed =
          typeof rawValue === 'number'
            ? rawValue
            : typeof rawValue === 'string' && rawValue.trim().length
              ? Number(rawValue.trim())
              : Number.NaN;
        if (!Number.isFinite(parsed)) {
          return {
            ok: false,
            status: 400,
            body: { ok: false, error: 'INVALID_EXTRA_FIELD', field: key, message: `${key} must be a number.` },
          };
        }
        validatedExtraInputValues[key] = parsed;
        continue;
      }

      if (schemaField.type === 'enum') {
        const parsed = typeof rawValue === 'number' ? rawValue : typeof rawValue === 'string' ? rawValue.trim() : '';
        if (parsed === '') {
          continue;
        }
        if (Array.isArray(schemaField.values) && !schemaField.values.some((value) => String(value) === String(parsed))) {
          return {
            ok: false,
            status: 400,
            body: {
              ok: false,
              error: 'INVALID_EXTRA_FIELD',
              field: key,
              message: `${key} must be one of ${(schemaField.values ?? []).join(', ')}.`,
            },
          };
        }
        validatedExtraInputValues[key] = parsed;
        continue;
      }

      if (schemaField.type === 'text') {
        const parsed = typeof rawValue === 'string' ? rawValue.trim() : '';
        if (!parsed) {
          continue;
        }
        validatedExtraInputValues[key] = parsed;
      }
    }
  }

  for (const field of applicableSchemaFields) {
    if (field.required && validatedExtraInputValues[field.id] == null) {
      return {
        ok: false,
        status: 400,
        body: {
          ok: false,
          error: 'MISSING_EXTRA_FIELD',
          field: field.id,
          message: `${field.id} is required for this mode.`,
        },
      };
    }
  }

  return { ok: true, values: validatedExtraInputValues };
}
