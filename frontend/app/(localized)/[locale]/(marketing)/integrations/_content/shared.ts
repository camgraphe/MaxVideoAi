import {
  MAXVIDEOAI_CODEX_MARKETPLACE_ADD_COMMAND,
  MAXVIDEOAI_CODEX_PLUGIN_ADD_COMMAND,
} from '@/config/maxvideoai-plugin-release';
import { localePathnames, type AppLocale } from '@/i18n/locales';
import { getMcpHost, getMcpIntegrationLabel } from '@/lib/mcp-integration-registry';
import { MCP_PRODUCTION_RESOURCE_URL } from '@/server/mcp/config';
import type { McpClientId, McpCompatibilityHostId } from '../../mcp/_lib/mcp-page-types';
import type { IntegrationPageCopy, IntegrationText } from './types';

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
  if (hostId === 'n8nMcpClient' || hostId === 'n8nMcpClientTool') {
    if (locale === 'fr') return `Construisez manuellement le workflow déterministe dans n8n auto-hébergé à partir du guide MaxVideoAI. Créez ensuite l’identifiant OAuth2 pour ${MCP_PRODUCTION_RESOURCE_URL} et associez-le à chaque nœud MCP Client.`;
    if (locale === 'es') return `Construye manualmente el flujo determinista en n8n self-hosted siguiendo la guía de MaxVideoAI. Después crea la credencial OAuth2 para ${MCP_PRODUCTION_RESOURCE_URL} y asígnala a cada nodo MCP Client.`;
    return `Build the deterministic workflow manually in self-hosted n8n from the MaxVideoAI setup guide. Then create the OAuth2 credential for ${MCP_PRODUCTION_RESOURCE_URL} and assign it to every MCP Client node.`;
  }

  const hostLabels: Partial<Record<McpCompatibilityHostId, string>> = {
    claudeCode: 'Claude Code',
    claudeDesktop: 'Claude Desktop',
    claudeWeb: 'Claude Web',
    chatgptWeb: 'ChatGPT',
    openclawGateway: 'OpenClaw',
    n8nMcpClient: 'n8n MCP Client',
    n8nMcpClientTool: 'n8n MCP Client Tool',
  };
  const host = hostLabels[hostId] ?? getMcpIntegrationLabel(getMcpHost(hostId).integration);
  const integration = getMcpHost(hostId).integration;
  const guidePath = locale === 'es' ? `/es/integraciones/${integration}` : localizedIntegrationPath(locale, `integrations/${integration}`);
  const setup = {
    en: {
      chatgptWeb: "In Plugins, choose Add → Add custom MCP server. This current path does not require enabling Developer mode first. Account and workspace permissions still apply. Name it MaxVideoAI, enter the production address below and retain detected OAuth. Review the warning, choose Create as a plugin, then Connect and approve access on maxvideoai.com. Avoid the Staging entry.",
      claudeWeb: "On an individual Claude plan (Free, Pro or Max), open Customize → Connectors → Your connectors → Add → Add custom connector. On Team or Enterprise, an owner first uses Organization settings → Connectors → Add → Custom → Web. Enter MaxVideoAI and the production URL below, then Continue. Review detected OAuth and automatic client registration, keep Connect now, then Add. Choose Connect and review the MaxVideoAI consent screen. The Free account tested allowed one custom connector. If that slot is occupied, choose whether to replace it before removing anything. Removing a connector in Claude does not prove that its authorization was revoked in MaxVideoAI.",
      claudeCode: `Configure Claude Code with: claude mcp add --transport http maxvideoai ${MCP_PRODUCTION_RESOURCE_URL}. Then guide me through /mcp to authorize my account.`,
      openclawGateway: 'Configure the remote server maxvideoai with Streamable HTTP and OAuth in OpenClaw, then run openclaw mcp login maxvideoai. Check shared versus per-requester identity first.',
    },
    fr: {
      chatgptWeb: "Dans Plugins, choisissez Ajouter → Ajouter un serveur MCP personnalisé. Ce parcours actuel ne nécessite pas d’activer le mode développeur au préalable. Les permissions du compte et de l’espace restent applicables. Nommez-le MaxVideoAI, saisissez l’adresse de production ci-dessous et conservez OAuth détecté. Examinez l’avertissement, choisissez Créer en tant que plugin, puis Connecter et approuvez les accès sur maxvideoai.com. Évitez l’entrée Staging.",
      claudeWeb: "Avec un compte individuel Claude (Free, Pro ou Max), ouvrez Personnalisation → Connecteurs → Les vôtres → Ajouter → Ajouter un connecteur personnalisé. En Team ou Enterprise, un propriétaire utilise d’abord Organization settings → Connectors → Add → Custom → Web. Saisissez MaxVideoAI et l’URL de production ci-dessous, puis Continuer. Vérifiez OAuth et l’enregistrement automatique du client, gardez Se connecter maintenant, puis Ajouter. Choisissez Connecter et vérifiez le consentement MaxVideoAI. Le compte Free testé autorisait un connecteur personnalisé. Si cette place est occupée, choisissez lequel conserver avant toute suppression. Supprimer un connecteur dans Claude ne prouve pas la révocation de son autorisation dans MaxVideoAI.",
      claudeCode: `Configure Claude Code avec : claude mcp add --transport http maxvideoai ${MCP_PRODUCTION_RESOURCE_URL}. Guide-moi ensuite dans /mcp pour autoriser mon compte.`,
      openclawGateway: 'Configure le serveur distant maxvideoai avec Streamable HTTP et OAuth dans OpenClaw, puis lance openclaw mcp login maxvideoai. Vérifie d’abord le choix entre identité partagée et identité par demandeur.',
    },
    es: {
      chatgptWeb: "En Plugins, elige Add → Add custom MCP server. Esta ruta actual no requiere activar antes Developer mode. Se siguen aplicando los permisos de la cuenta y del espacio. Usa el nombre MaxVideoAI y la dirección de producción indicada; conserva OAuth detectado. Revisa el aviso, elige Create as a plugin, después Connect y aprueba el acceso en maxvideoai.com. Evita la entrada Staging.",
      claudeWeb: "Con un plan individual de Claude (Free, Pro o Max), abre Customize → Connectors → Your connectors → Add → Add custom connector. En Team o Enterprise, un propietario usa primero Organization settings → Connectors → Add → Custom → Web. Introduce MaxVideoAI y la URL de producción indicada, después Continue. Revisa OAuth y el registro automático del cliente, conserva Connect now y pulsa Add. Elige Connect y revisa el consentimiento de MaxVideoAI. La cuenta Free probada permitía un conector personalizado. Si la plaza está ocupada, decide cuál conservar antes de eliminarlo. Eliminar un conector en Claude no demuestra la revocación de su autorización en MaxVideoAI.",
      claudeCode: `Configura Claude Code con: claude mcp add --transport http maxvideoai ${MCP_PRODUCTION_RESOURCE_URL}. Después guíame por /mcp para autorizar mi cuenta.`,
      openclawGateway: 'Configura el servidor remoto maxvideoai con Streamable HTTP y OAuth en OpenClaw y ejecuta openclaw mcp login maxvideoai. Comprueba primero la identidad compartida o por solicitante.',
    },
  };
  const instruction = setup[locale][hostId as keyof typeof setup.en];
  if (locale === 'fr') {
    return `${instruction ?? `Guide-moi pour connecter MaxVideoAI dans ${host}.`}\nUtilise uniquement la production : ${MCP_PRODUCTION_RESOURCE_URL}. Guide : https://maxvideoai.com${guidePath}\nSi une entrée MaxVideoAI Staging apparaît, n’utilise pas cette entrée : ses comptes sont distincts. Je me connecterai moi-même avec mon compte MaxVideoAI existant et validerai les accès dans le navigateur. Ne demande jamais mon mot de passe dans le chat. Après le retour, vérifie get_account_status et list_models uniquement, sans devis, génération ni paiement.`;
  }
  if (locale === 'es') {
    return `${instruction ?? `Guíame para conectar MaxVideoAI en ${host}.`}\nUsa solo producción: ${MCP_PRODUCTION_RESOURCE_URL}. Guía: https://maxvideoai.com${guidePath}\nSi aparece MaxVideoAI Staging, no uses esa entrada: sus cuentas son distintas. Iniciaré sesión con mi cuenta MaxVideoAI existente y aprobaré los permisos en el navegador. No pidas nunca mi contraseña en el chat. Después del regreso, comprueba solo get_account_status y list_models, sin precios, generación ni pagos.`;
  }
  return `${instruction ?? `Guide me through connecting MaxVideoAI in ${host}.`}\nUse production only: ${MCP_PRODUCTION_RESOURCE_URL}. Guide: https://maxvideoai.com${guidePath}\nIf MaxVideoAI Staging appears, do not use that entry: its accounts are separate. I will sign in with my existing MaxVideoAI account and approve access in the browser. Never ask for my password in chat. After returning, check get_account_status and list_models only, without quoting, generating or making a payment.`;
}

export function buildIntegrationCopy({
  client,
  locale,
  text,
}: {
  client: McpClientId;
  locale: AppLocale;
  text: IntegrationText;
}): IntegrationPageCopy {
  const clientLabel = getIntegrationLabel(client);
  return {
    client,
    clientLabel,
    meta: { title: text.metaTitle, description: text.metaDescription },
    hero: {
      eyebrow: text.eyebrow,
      title: text.heroTitle,
      intro: text.heroIntro,
      unavailable: text.unavailable,
      liveStatus: text.unavailable,
      accountStatus: text.unavailable,
      setupLabel: text.setupLabel,
      backLabel: text.backLabel,
      backHref: locale === 'en' ? '/mcp' : `/${locale}/mcp`,
    },
    compatibility: {
      checkpointLabel: text.checkpointLabel,
      machineStatusLabel: text.machineStatusLabel,
      statuses: text.statuses,
    },
    setup: {
      eyebrow: text.setupEyebrow,
      title: text.setupTitle,
      intro: text.setupIntro,
      installAction: getIntegrationInstallAction(locale, clientLabel),
      hostGuides: text.guides,
      oauthTitle: text.oauthTitle,
      oauthBody: text.oauthBody,
      oauthSteps: text.oauthSteps,
    },
    workflow: {
      eyebrow: text.workflowEyebrow,
      title: text.workflowTitle,
      intro: text.workflowIntro,
      previewSteps: text.workflowSteps,
      liveSteps: text.workflowSteps,
    },
    references: {
      title: text.referencesTitle,
      planningBody: text.referencesPlanning,
      liveBody: text.referencesGated,
      gatedBody: text.referencesGated,
    },
    troubleshooting: {
      eyebrow: text.helpEyebrow,
      title: text.helpTitle,
      intro: text.helpIntro,
      items: text.helpItems,
    },
    disconnect: {
      title: text.disconnectTitle,
      body: text.disconnectBody,
      steps: text.disconnectSteps,
    },
    support: {
      label: text.supportLabel,
      href: locale === 'en' ? '/contact' : `/${locale}/contact`,
    },
  };
}

export function getIntegrationInstallAction(locale: AppLocale, clientLabel: IntegrationPageCopy['clientLabel']): IntegrationPageCopy['setup']['installAction'] {
  if (locale === 'fr') {
    const isCodex = clientLabel === 'Codex';
    const isN8n = clientLabel === 'n8n';
    return {
      eyebrow: 'INSTALLATION RAPIDE',
      title: isN8n ? 'Construisez le workflow dans n8n' : isCodex ? 'Copiez, Codex installe le plugin' : `Copiez, ${clientLabel} vous guide`,
      body: isN8n
        ? 'Suivez le guide pour construire le workflow déterministe dans n8n auto-hébergé, puis configurez manuellement son identifiant OAuth2.'
        : isCodex
        ? 'Collez la demande dans Codex : il peut exécuter les commandes après votre autorisation.'
        : `Collez la demande dans ${clientLabel} : il vous indique exactement où ajouter MaxVideoAI et terminer la connexion.`,
      copyInstructionEnabled: !isN8n,
      showInstruction: isN8n ? 'Voir la configuration manuelle' : 'Voir ce qui sera copié',
      copyInstruction: isN8n ? 'Configurer n8n manuellement' : isCodex ? 'Copier et installer dans Codex' : `Copier pour être guidé dans ${clientLabel}`,
      copiedInstruction: isN8n ? 'Configuration manuelle affichée.' : `Copié — collez maintenant dans ${clientLabel}.`,
      copyEndpoint: 'Copier l’adresse MCP',
      copiedEndpoint: 'Adresse MCP copiée.',
      copyError: 'Copie impossible. Sélectionnez le texte puis copiez-le manuellement.',
      detailEyebrow: 'INSTALLATION DÉTAILLÉE',
      detailTitle: `Les 3 étapes dans ${clientLabel}`,
    };
  }
  if (locale === 'es') {
    const isCodex = clientLabel === 'Codex';
    const isN8n = clientLabel === 'n8n';
    return {
      eyebrow: 'INSTALACIÓN RÁPIDA',
      title: isN8n ? 'Construye el flujo en n8n' : isCodex ? 'Copia y Codex instala el plugin' : `Copia y ${clientLabel} te guía`,
      body: isN8n
        ? 'Sigue la guía para construir el flujo determinista en n8n self-hosted y configura manualmente su credencial OAuth2.'
        : isCodex
        ? 'Pega la petición en Codex: podrá ejecutar los comandos después de tu autorización.'
        : `Pega la petición en ${clientLabel}: te indicará exactamente dónde añadir MaxVideoAI y completar la conexión.`,
      copyInstructionEnabled: !isN8n,
      showInstruction: isN8n ? 'Ver la configuración manual' : 'Ver qué se copiará',
      copyInstruction: isN8n ? 'Configurar n8n manualmente' : isCodex ? 'Copiar e instalar en Codex' : `Copiar para recibir ayuda en ${clientLabel}`,
      copiedInstruction: isN8n ? 'Configuración manual mostrada.' : `Copiado — pégalo ahora en ${clientLabel}.`,
      copyEndpoint: 'Copiar dirección MCP',
      copiedEndpoint: 'Dirección MCP copiada.',
      copyError: 'No se pudo copiar. Selecciona el texto y cópialo manualmente.',
      detailEyebrow: 'INSTALACIÓN DETALLADA',
      detailTitle: `Los 3 pasos en ${clientLabel}`,
    };
  }
  const isCodex = clientLabel === 'Codex';
  const isN8n = clientLabel === 'n8n';
  return {
    eyebrow: 'FAST SETUP',
    title: isN8n ? 'Build the workflow in n8n' : isCodex ? 'Copy it, and Codex installs the plugin' : `Copy it, and ${clientLabel} guides you`,
    body: isN8n
      ? 'Follow the guide to build the deterministic workflow in self-hosted n8n, then configure its OAuth2 credential manually.'
      : isCodex
      ? 'Paste the request into Codex. It can run the commands after you approve them.'
      : `Paste the request into ${clientLabel}. It will show you exactly where to add MaxVideoAI and finish connecting.`,
    copyInstructionEnabled: !isN8n,
    showInstruction: isN8n ? 'See the manual configuration' : 'See what will be copied',
    copyInstruction: isN8n ? 'Configure n8n manually' : isCodex ? 'Copy and install in Codex' : `Copy for guidance in ${clientLabel}`,
    copiedInstruction: isN8n ? 'Manual configuration shown.' : `Copied — paste it into ${clientLabel}.`,
    copyEndpoint: 'Copy MCP address',
    copiedEndpoint: 'MCP address copied.',
    copyError: 'Unable to copy. Select the text and copy it manually.',
    detailEyebrow: 'DETAILED SETUP',
    detailTitle: `The 3 steps in ${clientLabel}`,
  };
}
