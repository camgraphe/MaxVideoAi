import type { EngineInputField } from '@/types/engines';
import { Button } from '@/components/ui/Button';

interface SettingsGenericAdvancedFieldsProps {
  fields: Array<{ field: EngineInputField; required: boolean }>;
  values: Record<string, unknown>;
  onChange?: (field: EngineInputField, value: unknown) => void;
}

export function SettingsGenericAdvancedFields({
  fields,
  values,
  onChange,
}: SettingsGenericAdvancedFieldsProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {fields.map(({ field, required }) => (
        <SettingsGenericAdvancedField
          key={field.id}
          field={field}
          required={required}
          value={values[field.id] ?? field.default ?? ''}
          onChange={onChange}
        />
      ))}
    </div>
  );
}

function SettingsGenericAdvancedField({
  field,
  required,
  value,
  onChange,
}: {
  field: EngineInputField;
  required: boolean;
  value: unknown;
  onChange?: (field: EngineInputField, value: unknown) => void;
}) {
  const label = `${field.label}${required ? ' *' : ''}`;
  const toggleButtonClass = 'min-h-0 h-auto px-3 py-1.5 text-[13px]';
  const activeToggleClass = (active: boolean) =>
    active
      ? 'border-brand bg-brand text-on-brand'
      : 'border-hairline bg-surface text-text-secondary hover:border-text-muted hover:bg-surface-2';

  if (field.type === 'boolean') {
    const active =
      typeof value === 'boolean'
        ? value
        : typeof value === 'string'
          ? value.trim().toLowerCase() === 'true'
          : typeof field.default === 'boolean'
            ? field.default
            : false;

    return (
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">{label}</span>
        <div className="flex flex-wrap gap-2">
          {[true, false].map((option) => (
            <Button
              key={`${field.id}-${option ? 'on' : 'off'}`}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onChange?.(field, option)}
              className={`${toggleButtonClass} ${activeToggleClass(option === active)}`}
            >
              {option ? 'On' : 'Off'}
            </Button>
          ))}
        </div>
        {field.description ? <span className="text-xs text-text-muted">{field.description}</span> : null}
      </label>
    );
  }
  if (field.type === 'enum') {
    const values = Array.isArray(field.values) ? field.values : [];
    return (
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">{label}</span>
        <select
          className="h-10 rounded-input border border-border bg-surface px-3 text-sm text-text-primary outline-none transition focus:border-brand"
          value={String(value ?? '')}
          onChange={(event) => onChange?.(field, event.target.value)}
        >
          <option value="">—</option>
          {values.map((optionValue) => (
            <option key={`${field.id}-${optionValue}`} value={String(optionValue)}>
              {String(optionValue)}
            </option>
          ))}
        </select>
        {field.description ? <span className="text-xs text-text-muted">{field.description}</span> : null}
      </label>
    );
  }
  if (field.type === 'number') {
    return (
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">{label}</span>
        <input
          type="number"
          value={value === '' || value == null ? '' : String(value)}
          onChange={(event) => onChange?.(field, event.target.value)}
          placeholder={
            typeof field.default === 'number' || typeof field.default === 'string'
              ? String(field.default)
              : ''
          }
          className="h-10 rounded-input border border-border bg-surface px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {field.description ? <span className="text-xs text-text-muted">{field.description}</span> : null}
      </label>
    );
  }
  return (
    <label className="flex flex-col gap-1.5 md:col-span-2 xl:col-span-3">
      <span className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">{label}</span>
      <textarea
        value={value === '' || value == null ? '' : String(value)}
        onChange={(event) => onChange?.(field, event.target.value)}
        placeholder={typeof field.default === 'string' ? field.default : ''}
        rows={3}
        className="min-h-[92px] rounded-input border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand"
      />
      {field.description ? <span className="text-xs text-text-muted">{field.description}</span> : null}
    </label>
  );
}
