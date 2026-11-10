import type { AppLocale } from '@/i18n/locales';
import type { ComparisonCopy, ComparisonCell } from '../_content/types';
import { comparisonSources, COMPARISON_CHECKED, COMPARISON_PUBLISHER } from './evidence';

export function comparisonData(copy: ComparisonCopy, locale: AppLocale, canonical: string) {
  return {
    publisher: COMPARISON_PUBLISHER, checkedAt: COMPARISON_CHECKED, language: locale,
    canonical, scope: copy.evidence.scope, disclosure: copy.evidence.publisher,
    web: copy.matrix.rows, webLimitations: copy.matrix.note,
    assistants: copy.matrix.assistantRows, assistantLimitations: copy.matrix.assistantNote,
    competitorFit: copy.matrix.fairText, methodology: copy.methodology.items,
    sources: comparisonSources, reuse: copy.share.reuse,
  };
}

export function comparisonCsv(copy: ComparisonCopy, locale: AppLocale, canonical: string) {
  const data = comparisonData(copy, locale, canonical);
  const rows: string[][] = [['scope', 'question', 'maxvideoai', 'maxvideoai_detail', 'higgsfield', 'higgsfield_detail', 'checked_at', 'publisher', 'canonical', 'sources', 'limitations']];
  for (const [scope, facts, limitations] of [
    ['web', data.web, data.webLimitations], ['assistants', data.assistants, data.assistantLimitations],
  ] as const) {
    for (const row of facts) rows.push([scope, row.label, row.max.title, row.max.detail, row.higgsfield.title, row.higgsfield.detail, data.checkedAt, data.publisher, canonical, row.sources.map((id) => comparisonSources.find((source) => source.id === id)?.url ?? '').join(' | '), limitations]);
  }
  return '\uFEFF' + rows.map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(',')).join('\r\n') + '\r\n';
}

const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function wrap(value: string, max: number): string[] {
  const words = value.trim().split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (line && (line.length + word.length + 1) > max) { lines.push(line); line = word; }
    else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}
function text(lines: string[], x: number, y: number, size = 20, color = '#232323', weight = 400, lineHeight = 28) {
  return `<text x="${x}" y="${y}" fill="${color}" font-family="Arial, sans-serif" font-size="${size}" font-weight="${weight}">${lines.map((line, index) => `<tspan x="${x}" dy="${index ? lineHeight : 0}">${escape(line)}</tspan>`).join('')}</text>`;
}
function measureCell(cell: ComparisonCell) {
  return { title: wrap(cell.title, 28), detail: wrap(cell.detail, 37) };
}

/** Dated chart generated from the same Web and assistant rows as the accessible HTML. */
export function comparisonSvg(copy: ComparisonCopy, canonical: string, social = false) {
  const width = 1200;
  const parts: string[] = [];
  let y = 222;
  const rows = social ? copy.matrix.rows.slice(0, 2) : [...copy.matrix.rows, ...copy.matrix.assistantRows];
  parts.push(text(['MaxVideoAI'], 48, 49, 22, '#805126', 600));
  parts.push(text(['MaxVideoAI vs Higgsfield'], 48, 111, 48, '#232323', 600, 52));
  parts.push(text([`${copy.matrix.scope} · ${copy.matrix.checked}`], 48, 151, 18, '#625e58'));
  parts.push(`<rect x="348" y="181" width="400" height="48" fill="#d6e5d6"/><rect x="748" y="181" width="404" height="48" fill="#e9e5de"/>`);
  parts.push(text(['MaxVideoAI'], 366, 212, 23, '#205d43', 600));
  parts.push(text(['Higgsfield'], 766, 212, 23, '#232323', 600));
  y = 229;
  for (const row of rows) {
    if (!social && row.id === copy.matrix.assistantRows[0]?.id) {
      const heading = wrap(copy.matrix.assistantTitle, 85);
      const height = heading.length * 28 + 26;
      parts.push(`<rect x="48" y="${y}" width="1104" height="${height}" fill="#e9e5de"/>`);
      parts.push(text(heading, 66, y + 32, 23, '#232323', 600));
      y += height;
    }
    const left = measureCell(row.max), right = measureCell(row.higgsfield), label = wrap(row.label, 23);
    const height = social ? 137 : Math.max(label.length * 28, ...[left, right].map((cell) => cell.title.length * 28 + cell.detail.length * 24 + 18)) + 42;
    parts.push(`<path d="M48 ${y}H1152" stroke="#c8c5bc"/>`);
    parts.push(text(label, 48, y + 31, social ? 20 : 22, '#232323', 600, 28));
    for (const [cell, measured, x] of [[row.max, left, 348], [row.higgsfield, right, 748]] as const) {
      const fill = cell.tone === 'advantage' ? '#e5efe6' : cell.tone === 'condition' ? '#f1e7d5' : '#f4f2ee';
      const ink = cell.tone === 'advantage' ? '#205d43' : cell.tone === 'condition' ? '#825821' : '#232323';
      parts.push(`<rect x="${x}" y="${y + 1}" width="400" height="${height - 1}" fill="${fill}"/>`);
      parts.push(text(measured.title, x + 18, y + 31, 22, ink, 600, 28));
      if (!social) parts.push(text(measured.detail, x + 18, y + 31 + measured.title.length * 28 + 13, 18, '#4e5049', 400, 24));
    }
    y += height;
  }
  parts.push(`<path d="M48 ${y}H1152" stroke="#c8c5bc"/>`);
  if (social) {
    // Social preview is an invitation to inspect the full dated comparison.
    parts.push(text(wrap(copy.share.attribution, 95), 48, 548, 18, '#625e58', 400, 24));
    parts.push(text(['maxvideoai.com/higgsfield-alternative'], 48, 601, 20, '#805126', 600));
    return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#f4f2ee"/>${parts.join('')}</svg>`, width, height: 630 };
  }
  const notes = [...wrap(copy.matrix.note, 107), '', ...wrap(copy.matrix.assistantNote, 107), '', ...wrap(copy.matrix.fairText, 107), '', ...wrap(copy.evidence.publisher, 107)];
  parts.push(text(notes, 48, y + 38, 18, '#625e58', 400, 25));
  y += 38 + notes.length * 25;
  parts.push(text([canonical.replace('https://', '') + '#comparison'], 48, y + 28, 20, '#805126', 600));
  const height = y + 70;
  const accessibleTitle = `MaxVideoAI vs Higgsfield · ${copy.matrix.scope} + MCP · ${copy.matrix.checked}`;
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(accessibleTitle)}"><title>${escape(accessibleTitle)}</title><desc>${escape(copy.evidence.publisher + ' ' + copy.matrix.note + ' ' + copy.matrix.assistantNote)}</desc><rect width="${width}" height="${height}" fill="#f4f2ee"/>${parts.join('')}</svg>`, width, height };
}
