import Image from 'next/image';
import Link from 'next/link';
import { getPathname } from '@/i18n/navigation';
import type { Locale } from '@/lib/i18n/types';
import { AppGlyph } from './AppGlyph';

const assistants = [
  { id: 'chatgpt', name: 'ChatGPT', href: '/integrations/chatgpt', folder: 'openai', mark: 'openai' },
  { id: 'claude', name: 'Claude', href: '/integrations/claude', folder: 'anthropic', mark: 'claude' },
] as const;

export function AppAssistantMarks() {
  return <span className="app-assistant-marks" aria-hidden="true">{assistants.map((assistant) => <AssistantMark key={assistant.id} assistant={assistant} />)}</span>;
}

function AssistantMark({ assistant }: { assistant: (typeof assistants)[number] }) {
  return <span className={`app-assistant-mark app-assistant-mark-${assistant.id}`}>
    <Image src={`/brand/partners/${assistant.folder}/${assistant.mark}-mark-light.svg`} width={24} height={24} alt="" aria-hidden="true" className="dark:hidden" />
    <Image src={`/brand/partners/${assistant.folder}/${assistant.mark}-mark-dark.svg`} width={24} height={24} alt="" aria-hidden="true" className="hidden dark:block" />
  </span>;
}

export function AppAssistantConnections({ locale, onNavigate }: { locale: Locale; onNavigate: () => void }) {
  const copy = locale === 'fr'
    ? { title: 'Créez avec votre assistant', detail: 'Les modèles MaxVideoAI, depuis votre conversation.', connect: 'Connecter', all: 'Tous les assistants', newTab: 'nouvel onglet' }
    : locale === 'es'
      ? { title: 'Crea con tu asistente', detail: 'Los modelos de MaxVideoAI, desde tu conversación.', connect: 'Conectar', all: 'Todos los asistentes', newTab: 'pestaña nueva' }
      : { title: 'Create with your assistant', detail: 'MaxVideoAI models, from your conversation.', connect: 'Connect', all: 'All assistants', newTab: 'new tab' };
  return <section className="app-assistant-connections" aria-label={copy.title}>
    <h3>{copy.title}</h3><p>{copy.detail}</p>
    <div className="app-assistant-options">{assistants.map((assistant) => <Link key={assistant.id} href={getPathname({ locale, href: assistant.href })} target="_blank" rel="noopener noreferrer" prefetch={false} onClick={onNavigate}>
      <AssistantMark assistant={assistant} /><span><strong>{assistant.name}</strong><small>{copy.connect}</small></span><span className="sr-only"> ({copy.newTab})</span>
    </Link>)}</div>
    <div className="app-assistant-more">
      <Link href={getPathname({ locale, href: '/integrations/codex' })} target="_blank" rel="noopener noreferrer" prefetch={false} onClick={onNavigate}>Codex <AppGlyph name="external" /><span className="sr-only"> ({copy.newTab})</span></Link>
      <Link href={getPathname({ locale, href: '/mcp' })} target="_blank" rel="noopener noreferrer" prefetch={false} onClick={onNavigate}>{copy.all} <AppGlyph name="external" /><span className="sr-only"> ({copy.newTab})</span></Link>
    </div>
  </section>;
}
