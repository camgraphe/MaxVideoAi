export function ratioToCssAspectRatio(ratio?: string | null): string {
  if (!ratio) {
    return "16 / 9";
  }

  const match = /^\s*(\d+)\s*:\s*(\d+)\s*$/.exec(ratio);
  if (!match) {
    return "16 / 9";
  }

  const width = Number(match[1]);
  const height = Number(match[2]);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return "16 / 9";
  }

  return `${width} / ${height}`;
}
