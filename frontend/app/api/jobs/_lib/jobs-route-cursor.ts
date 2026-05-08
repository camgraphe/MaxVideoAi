export function parseCursorParam(value: string | null): { createdAt: Date | null; id: number | null } {
  if (!value) {
    return { createdAt: null, id: null };
  }
  if (value.includes('|')) {
    const [timestampPart, idPart] = value.split('|', 2);
    let createdAt: Date | null = null;
    if (timestampPart) {
      const parsed = new Date(timestampPart);
      if (!Number.isNaN(parsed.getTime())) {
        createdAt = parsed;
      }
    }
    let id: number | null = null;
    if (idPart) {
      const parsed = Number.parseInt(idPart, 10);
      if (Number.isFinite(parsed)) {
        id = parsed;
      }
    }
    return { createdAt, id };
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isFinite(parsed)) {
    return { createdAt: null, id: parsed };
  }
  return { createdAt: null, id: null };
}

export function formatCursorValue(row: { created_at: string; id: number }): string {
  const createdAt = new Date(row.created_at);
  if (Number.isNaN(createdAt.getTime())) {
    return String(row.id);
  }
  return `${createdAt.toISOString()}|${row.id}`;
}
