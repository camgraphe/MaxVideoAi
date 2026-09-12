import {
  MAXVIDEOAI_CODEX_MARKETPLACE_ADD_COMMAND,
  MAXVIDEOAI_CODEX_PLUGIN_ADD_COMMAND,
} from '@/config/maxvideoai-plugin-release';
import { localePathnames, type AppLocale } from '@/i18n/locales';
import { getMcpIntegrationLabel } from '@/lib/mcp-integration-registry';
import { MCP_PRODUCTION_RESOURCE_URL } from '@/server/mcp/config';
import type { McpClientId, McpCompatibilityHostId } from '../../mcp/_lib/mcp-page-types';
import type { IntegrationPageCopy } from './types';

export function localizedIntegrationPath(locale: AppLocale, path: string): string {
  const prefix = localePathnames[locale];
  return `/${[prefix, path.replace(/^\/+/, '')].filter(Boolean).join('/')}`;
}
export function getIntegrationLabel(client: McpClientId): IntegrationPageCopy['clientLabel'] {
  return getMcpIntegrationLabel(client);
}

export function getIntegrationInstallInstruction(locale: AppLocale, hostId: McpCompatibilityHostId): string {
  if (hostId === 'codexCli') {
    if (locale === 'fr') {
      return `Installe le plugin MaxVideoAI pour moi avec ces commandes, puis guide-moi pour connecter mon compte :\n${MAXVIDEOAI_CODEX_MARKETPLACE_ADD_COMMAND}\n${MAXVIDEOAI_CODEX_PLUGIN_ADD_COMMAND}`;
    }
    if (locale === 'es') {
      return `Instala el plugin MaxVideoAI por mí con estos comandos y guíame para conectar mi cuenta:\n${MAXVIDEOAI_CODEX_MARKETPLACE_ADD_COMMAND}\n${MAXVIDEOAI_CODEX_PLUGIN_ADD_COMMAND}`;
    }
    return `Install the MaxVideoAI plugin for me with these commands, then guide me through connecting my account:\n${MAXVIDEOAI_CODEX_MARKETPLACE_ADD_COMMAND}\n${MAXVIDEOAI_CODEX_PLUGIN_ADD_COMMAND}`;
  }

  const host = hostId === 'claudeCode' ? 'Claude Code' : hostId === 'claudeDesktop' ? 'Claude' : 'ChatGPT';
  if (locale === 'fr') {
    return `Connecte MaxVideoAI dans ${host} avec ce serveur MCP et guide-moi jusqu’à la connexion : ${MCP_PRODUCTION_RESOURCE_URL}`;
  }
  if (locale === 'es') {
    return `Conecta MaxVideoAI en ${host} con este servidor MCP y guíame hasta completar la conexión: ${MCP_PRODUCTION_RESOURCE_URL}`;
  }
  return `Connect MaxVideoAI in ${host} with this MCP server and guide me through the connection: ${MCP_PRODUCTION_RESOURCE_URL}`;
}

export function getIntegrationInstallAction(locale: AppLocale, clientLabel: IntegrationPageCopy['clientLabel']): IntegrationPageCopy['setup']['installAction'] {
  if (locale === 'fr') {
    const isCodex = clientLabel === 'Codex';
    return {
      eyebrow: 'INSTALLATION RAPIDE',
      title: isCodex ? 'Copiez, Codex installe le plugin' : `Copiez, ${clientLabel} vous guide`,
      body: isCodex
        ? 'Collez la demande dans Codex : il peut exécuter les commandes après votre autorisation.'
        : `Collez la demande dans ${clientLabel} : il vous indique exactement où ajouter MaxVideoAI et terminer la connexion.`,
      showInstruction: 'Voir ce qui sera copié',
      copyInstruction: isCodex ? 'Copier et installer dans Codex' : `Copier pour être guidé dans ${clientLabel}`,
      copiedInstruction: `Copié — collez maintenant dans ${clientLabel}.`,
      copyEndpoint: 'Copier l’adresse MCP',
      copiedEndpoint: 'Adresse MCP copiée.',
      copyError: 'Copie impossible. Sélectionnez le texte puis copiez-le manuellement.',
      detailEyebrow: 'INSTALLATION DÉTAILLÉE',
      detailTitle: `Les 3 étapes dans ${clientLabel}`,
    };
  }
  if (locale === 'es') {
    const isCodex = clientLabel === 'Codex';
    return {
      eyebrow: 'INSTALACIÓN RÁPIDA',
      title: isCodex ? 'Copia y Codex instala el plugin' : `Copia y ${clientLabel} te guía`,
      body: isCodex
        ? 'Pega la petición en Codex: podrá ejecutar los comandos después de tu autorización.'
        : `Pega la petición en ${clientLabel}: te indicará exactamente dónde añadir MaxVideoAI y completar la conexión.`,
      showInstruction: 'Ver qué se copiará',
      copyInstruction: isCodex ? 'Copiar e instalar en Codex' : `Copiar para recibir ayuda en ${clientLabel}`,
      copiedInstruction: `Copiado — pégalo ahora en ${clientLabel}.`,
      copyEndpoint: 'Copiar dirección MCP',
      copiedEndpoint: 'Dirección MCP copiada.',
      copyError: 'No se pudo copiar. Selecciona el texto y cópialo manualmente.',
      detailEyebrow: 'INSTALACIÓN DETALLADA',
      detailTitle: `Los 3 pasos en ${clientLabel}`,
    };
  }
  const isCodex = clientLabel === 'Codex';
  return {
    eyebrow: 'FAST SETUP',
    title: isCodex ? 'Copy it, and Codex installs the plugin' : `Copy it, and ${clientLabel} guides you`,
    body: isCodex
      ? 'Paste the request into Codex. It can run the commands after you approve them.'
      : `Paste the request into ${clientLabel}. It will show you exactly where to add MaxVideoAI and finish connecting.`,
    showInstruction: 'See what will be copied',
    copyInstruction: isCodex ? 'Copy and install in Codex' : `Copy for guidance in ${clientLabel}`,
    copiedInstruction: `Copied — paste it into ${clientLabel}.`,
    copyEndpoint: 'Copy MCP address',
    copiedEndpoint: 'MCP address copied.',
    copyError: 'Unable to copy. Select the text and copy it manually.',
    detailEyebrow: 'DETAILED SETUP',
    detailTitle: `The 3 steps in ${clientLabel}`,
  };
}
