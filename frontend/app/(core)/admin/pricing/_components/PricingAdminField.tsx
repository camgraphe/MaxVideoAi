type PricingAdminFieldProps = {
  label: string;
  value: string;
  disabled?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
};

export function PricingAdminField({ label, value, disabled, onChange, placeholder }: PricingAdminFieldProps) {
  return (
    <label className="flex flex-col gap-1 text-xs text-text-secondary">
      <span className="text-text-tertiary">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="rounded-lg border border-hairline px-3 py-2 text-sm font-medium text-text-primary focus:border-text-muted focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:bg-muted"
      />
    </label>
  );
}
