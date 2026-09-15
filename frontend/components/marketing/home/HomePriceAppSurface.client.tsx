'use client';

import { I18nProvider } from '@/lib/i18n/I18nProvider';
import type { Dictionary } from '@/lib/i18n/types';
import { Composer } from '@/components/Composer';
import { CoreSettingsBar } from '@/components/CoreSettingsBar';
import type { HomePriceModel, HomePriceStep } from './home-price-demo-types';
import type { AppLocale } from '@/i18n/locales';

const noop = () => {};
const COPY = {
 en:{prompt:'A quiet cinematic shot of neon-lit Tokyo streets in the rain.',generate:'Generate',model:'Choose model',video:'Video'},
 fr:{prompt:'Un plan cinématographique des rues de Tokyo sous la pluie, éclairées par les néons.',generate:'Générer',model:'Choisir un modèle',video:'Vidéo'},
 es:{prompt:'Un plano cinematográfico de las calles de Tokio bajo la lluvia, iluminadas por neones.',generate:'Generar',model:'Elegir modelo',video:'Video'},
};

/** Real workspace components, inert for this guided demonstration: no generation endpoint. */
export function HomePriceAppSurface({model,step,locale}:{model:HomePriceModel;step:HomePriceStep;locale:AppLocale}) {
 const c = COPY[locale];
 const dictionary = {workspace:model.workspaceCopy} as unknown as Dictionary;
 return <I18nProvider locale={locale} dictionary={dictionary} fallback={dictionary}><div className="price-app-surface" inert aria-hidden="true">
   <div className="price-app-top"><strong>MaxVideoAI</strong><span>{c.video}</span></div>
   <div className="price-app-model"><small>{c.model}</small><strong>{model.engine.label}<span>Alibaba · 3.0</span></strong></div>
   <Composer density="workspace" engine={model.engine} caps={model.engine.modeCaps?.t2v}
     prompt={c.prompt} onPromptChange={noop} price={step.amountCents / 100} currency="USD"
     isLoading={false} promptRequired assetFields={[]} assets={{}} onGenerate={noop} generateLabel={c.generate}
     settingsBar={<CoreSettingsBar density="workspace" engine={model.engine} caps={model.engine.modeCaps?.t2v} mode="t2v"
       durationSec={step.seconds} onDurationChange={noop} resolution={step.resolution} onResolutionChange={noop}
       aspectRatio="16:9" onAspectRatioChange={noop} fps={30} onFpsChange={noop}
       showAudioControl audioEnabled onAudioChange={noop} iterations={1} onIterationsChange={noop}/>} />
 </div></I18nProvider>;
}
