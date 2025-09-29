export function formatCurrency(valueCents: number, locale: string = "en-US") {
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
  return formatter.format(valueCents / 100);
}

export function formatDuration(seconds: number) {
  return `${seconds.toFixed(1)} s`;
}
