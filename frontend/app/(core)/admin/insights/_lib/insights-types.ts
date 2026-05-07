export type FocusMetric = 'signups' | 'active' | 'topups' | 'charges';

export type PageProps = {
  searchParams?: Promise<{
    range?: string;
    excludeAdmin?: string | string[];
    focus?: string | string[];
  }>;
};

export type ChartPoint = {
  label: string;
  value: number;
};

export type SmallStat = {
  label: string;
  value: string;
  helper?: string;
  tone?: 'default' | 'success' | 'warning';
};

export type PulseCard = {
  label: string;
  value: string;
  previousValue: string;
  delta: string;
  helper: string;
  tone?: 'default' | 'success' | 'warning';
};

export type PrioritySignal = {
  label: string;
  value: string;
  helper: string;
  href: string;
  tone?: 'default' | 'success' | 'warning';
};

export type RevenueBoardRow = {
  label: string;
  current: string;
  previous: string;
  delta: string;
  helper: string;
  tone?: 'default' | 'success' | 'warning';
};

export type DeltaSnapshot = {
  current: number;
  previous: number;
  absoluteChange: number;
  ratioChange: number | null;
};

export type ChartTheme = {
  bar: string;
  line: string;
};

export type FunnelStep = {
  label: string;
  value: number;
  helper: string;
  shareOfStart: number;
  conversionFromPrevious: number | null;
  accent: string;
};

export type LedgerRow = {
  date: string;
  signups: number;
  active: number;
  topupsUsd: number;
  chargesUsd: number;
};

export type FocusMetricData = {
  key: FocusMetric;
  label: string;
  description: string;
  theme: ChartTheme;
  currentPoints: ChartPoint[];
  previousPoints: ChartPoint[];
  stats: SmallStat[];
  axisFormatter?: (value: number) => string;
  tooltipFormatter?: (value: number) => string;
};
