function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function truncateAtSpace(value: string, max: number): string {
  if (value.length <= max) return value;
  const sliced = value.slice(0, max);
  const lastSpace = sliced.lastIndexOf(' ');
  if (lastSpace > 40) {
    return `${sliced.slice(0, lastSpace)}…`;
  }
  return `${sliced}…`;
}

export function buildMetaTitle(input: string): string {
  // Search engines size their own title links. Preserve complete authored text.
  return normalizeWhitespace(input);
}

export function buildMetaDescription(input: string, max = 160): string {
  const normalized = normalizeWhitespace(input);
  if (normalized.length <= max) return normalized;
  return truncateAtSpace(normalized, max);
}
