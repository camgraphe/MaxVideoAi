import type { AppLocale } from '@/i18n/locales';

const navigation = {
  en: { setup: 'ChatGPT and Codex', 'other-clients': 'Integration guides', endpoint: 'MCP server address', reference: 'Reference files', approve: 'Credits and approval', recover: 'Results and recovery', troubleshoot: 'Troubleshooting' },
  fr: { setup: 'ChatGPT et Codex', 'other-clients': 'Guides par intégration', endpoint: 'Adresse du serveur MCP', reference: 'Fichiers de référence', approve: 'Crédits et validation', recover: 'Retrouver un résultat', troubleshoot: 'Dépannage' },
  es: { setup: 'ChatGPT y Codex', 'other-clients': 'Guías de integración', endpoint: 'Dirección del servidor MCP', reference: 'Archivos de referencia', approve: 'Créditos y aprobación', recover: 'Recuperar resultados', troubleshoot: 'Solución de problemas' },
} satisfies Record<AppLocale, Record<string, string>>;

function wrapTroubleshootingAnswers(html: string): string {
  return html.replace(/<h3>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3>|$)/g, (_match, question, answer) =>
    `<details><summary><h3>${question}</h3></summary>${answer}</details>`
  );
}

export function getMcpManualSections(html: string, locale: AppLocale) {
  const labels = navigation[locale];
  return html.trim().split(/(?=<h2>)/).filter(Boolean).map(part => {
    // The Markdown author chooses the stable fragment with a linked heading.
    // The rest of the already-sanitized article stays intact, including its tables.
    const heading = /^<h2><a href="#([a-z-]+)">([^<]+)<\/a><\/h2>/.exec(part);
    const id = heading?.[1];
    const content = heading ? part.replace(heading[0], `<h2>${heading[2]}</h2>`) : part;
    return {
      id,
      navLabel: id && Object.hasOwn(labels, id) ? labels[id as keyof typeof labels] : undefined,
      html: id === 'troubleshoot' ? wrapTroubleshootingAnswers(content) : content,
    };
  });
}
