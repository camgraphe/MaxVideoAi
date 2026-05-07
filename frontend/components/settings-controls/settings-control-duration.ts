export type DurationOptionMeta = {
  raw: number | string;
  value: number;
  label: string;
};

export function parseDurationOptionValue(option: number | string): DurationOptionMeta {
  if (typeof option === 'number') {
    return {
      raw: option,
      value: option,
      label: `${option}s`,
    };
  }
  const numeric = Number(option.replace(/[^\d.]/g, ''));
  return {
    raw: option,
    value: Number.isFinite(numeric) ? numeric : 0,
    label: option,
  };
}

export function matchesDurationOptionValue(option: DurationOptionMeta, raw: number | string | null | undefined, seconds: number): boolean {
  if (raw != null) {
    if (typeof raw === 'number') {
      return Math.abs(option.value - raw) < 0.001;
    }
    if (typeof raw === 'string') {
      if (raw === option.raw || raw === option.label) return true;
      const numeric = Number(raw.replace(/[^\d.]/g, ''));
      if (Number.isFinite(numeric)) {
        return Math.abs(option.value - numeric) < 0.001;
      }
    }
  }
  return Math.abs(option.value - seconds) < 0.001;
}
