import Image from 'next/image';
import Link from 'next/link';
import type { AppLocale } from '@/i18n/locales';

const COPY = {
  en: { title: 'Create with your assistant, too.', body: 'Turn your conversation into a video. Review the price, approve the generation, and find the result in MaxVideoAI.', more: 'Codex and other assistants', cta: 'Explore connections' },
  fr: { title: 'Créez aussi avec votre assistant.', body: 'Passez de votre conversation à une vidéo. Vérifiez le prix, validez la génération et retrouvez le résultat dans MaxVideoAI.', more: 'Codex et d’autres assistants', cta: 'Voir les connexions' },
  es: { title: 'Crea también con tu asistente.', body: 'Convierte tu conversación en un video. Revisa el precio, autoriza la generación y encuentra el resultado en MaxVideoAI.', more: 'Codex y otros asistentes', cta: 'Ver las conexiones' },
};

export function HomeAssistantStrip({locale, href}: {locale:AppLocale; href:string}) {
  const copy = COPY[locale];
  return <div id="assistants" className="home-assistant-strip">
    <div className="home-assistant-strip-copy"><h3>{copy.title}</h3><p>{copy.body}</p></div>
    <div className="home-assistant-strip-access">
      <div className="home-assistant-strip-brands">
        <span><Image src="/brand/partners/anthropic/claude-mark-dark.svg" alt="" aria-hidden="true" width={24} height={24}/>Claude</span>
        <span><Image src="/brand/partners/openai/openai-mark-dark.svg" alt="" aria-hidden="true" width={24} height={24}/>ChatGPT</span>
        <span><Image src="/brand/partners/openclaw/openclaw-icon.png" alt="" aria-hidden="true" width={24} height={24}/>OpenClaw</span>
      </div>
      <p>{copy.more}</p>
      <Link href={href} className="home-assistant-strip-link" data-analytics-event="cta_click" data-analytics-cta-name="home_assistant_connections" data-analytics-cta-location="home_creation">{copy.cta}<span aria-hidden>↗</span></Link>
    </div>
  </div>;
}
