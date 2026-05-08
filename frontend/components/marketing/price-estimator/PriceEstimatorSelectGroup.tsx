import clsx from 'clsx';
import { SelectMenu, type SelectOption } from '@/components/ui/SelectMenu';

type PriceEstimatorSelectGroupProps = {
  label: string;
  options: SelectOption[];
  value: SelectOption['value'];
  onChange: (value: SelectOption['value']) => void;
  className?: string;
};

export function PriceEstimatorSelectGroup({
  label,
  options,
  value,
  onChange,
  className,
}: PriceEstimatorSelectGroupProps) {
  if (!options.length) return null;
  return (
    <div className={clsx('flex min-w-0 flex-col gap-1', className)}>
      <span className="text-[10px] uppercase tracking-micro text-text-muted">{label}</span>
      <SelectMenu options={options} value={value} onChange={onChange} />
    </div>
  );
}
