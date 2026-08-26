import type { AppLocale } from '@/i18n/locales';

export type McpHostProofClient = 'chatgpt' | 'claude' | 'codex';

export type McpHostProof = {
  host: 'claude';
  assetSrc: string;
  mimeType: 'image/jpeg';
  width: number;
  height: number;
  eyebrow: string;
  heading: string;
  caption: string;
  alt: string;
  capturedAt: string;
  hostVersion: string;
  hostLocale: string;
  operatingSystem: string;
  environment: 'controlled-staging';
  serverOrigin: string;
  deploymentId: string;
  sourceRevision: string;
  resourceUri: string;
  evidenceReference: string;
};

const copy: Record<AppLocale, Pick<McpHostProof, 'eyebrow' | 'heading' | 'caption' | 'alt'>> = {
  en: {
    eyebrow: 'Claude Desktop · Controlled test',
    heading: 'Video result shown in Claude',
    caption:
      'A completed MaxVideoAI video displayed inline in Claude Desktop during a controlled test. The result is saved to the connected MaxVideoAI library. The $0.95 shown is the amount recorded for this capture, not a current quote.',
    alt:
      'Claude Desktop conversation showing a completed MaxVideoAI video in an inline player, a $0.95 capture amount, library-save confirmation, and an Open in MaxVideoAI button.',
  },
  fr: {
    eyebrow: 'Claude Desktop · Test contrôlé',
    heading: 'Résultat vidéo affiché dans Claude',
    caption:
      'Une vidéo MaxVideoAI terminée affichée directement dans Claude Desktop lors d’un test contrôlé. Le résultat est enregistré dans la bibliothèque MaxVideoAI connectée. Les 0,95 $ affichés correspondent à cette capture, pas à un devis actuel.',
    alt:
      'Conversation Claude Desktop montrant une vidéo MaxVideoAI terminée dans un lecteur intégré, un montant de capture de 0,95 $, la confirmation d’enregistrement dans la bibliothèque et le bouton Ouvrir dans MaxVideoAI.',
  },
  es: {
    eyebrow: 'Claude Desktop · Prueba controlada',
    heading: 'Resultado de vídeo mostrado en Claude',
    caption:
      'Un vídeo MaxVideoAI terminado mostrado en línea en Claude Desktop durante una prueba controlada. El resultado se guarda en la biblioteca MaxVideoAI conectada. Los 0,95 $ mostrados corresponden a esta captura, no a un precio actual.',
    alt:
      'Conversación de Claude Desktop con un vídeo MaxVideoAI terminado en un reproductor integrado, un importe de captura de 0,95 $, confirmación de guardado en la biblioteca y un botón para abrir MaxVideoAI.',
  },
};

export function getMcpHostProof(client: McpHostProofClient, locale: AppLocale): McpHostProof | null {
  if (client !== 'claude') return null;
  return {
    host: 'claude',
    assetSrc: '/media/mcp/claude-inline-video-proof.jpg',
    mimeType: 'image/jpeg',
    width: 1152,
    height: 768,
    ...copy[locale],
    capturedAt: '2026-08-26T16:31:42+02:00',
    hostVersion: 'Claude Desktop 1.37937.1',
    hostLocale: 'fr-FR',
    operatingSystem: 'macOS 26.5.1 (25F80)',
    environment: 'controlled-staging',
    serverOrigin: 'https://maxvideoai-mcp-staging.vercel.app',
    deploymentId: 'dpl_3i6XgnZ6KVCZmQPhhKBrHDVrm1TD',
    sourceRevision: '621881dae621e9aec1d68a2a86f5065c6325cdb8',
    resourceUri: 'ui://maxvideoai/generation-result-v1.html',
    evidenceReference: 'host-ui-claude-2026-08-26-v1',
  };
}
