import type { AppLocale } from '@/i18n/locales';

const labels: Record<AppLocale, readonly [string, string]> = {
  en: ['Integration comparison — scroll horizontally', 'MCP tools — scroll horizontally'],
  fr: ['Comparatif des intégrations — défilement horizontal', 'Outils MCP — défilement horizontal'],
  es: ['Comparación de integraciones — desplazamiento horizontal', 'Herramientas MCP — desplazamiento horizontal'],
};

/** Add scroll regions to the two tables in authored, sanitized MCP Markdown HTML.
 * Keep the original HTML bytes and recognize the immediate wrappers emitted here. */
export function wrapMcpDocsTables(html: string, locale: AppLocale): string {
  let index = 0;
  return html.replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, (table, offset: number) => {
    const label = labels[locale][Math.min(index++, 1)];
    const opening = html.slice(0, offset).match(/<div\b([^<>]*)>\s*$/i);
    const classes = opening?.[1].match(/\bclass\s*=\s*(["'])(.*?)\1/i)?.[2].split(/\s+/);
    if (classes?.includes('mcp-docs-table-scroll')) return table;
    return `<div class="mcp-docs-table-scroll" role="region" aria-label="${label}" tabindex="0">${table}</div>`;
  });
}
