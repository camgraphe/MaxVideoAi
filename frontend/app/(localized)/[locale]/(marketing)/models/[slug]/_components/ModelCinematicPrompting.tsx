import { Link } from '@/i18n/navigation';
import type { ModelPromptingViewModel } from '../_lib/model-page-prompting-view-model';
import type { CinematicPresentation } from '../_lib/model-page-cinematic-data';
import { ModelDecisionCopyButton } from './ModelDecisionCopyButton.client';
import { ModelCinematicPromptAssistant } from './ModelCinematicPromptAssistant';
import { ModelCinematicAsset } from './ModelCinematicAsset';

export function ModelCinematicPrompting({ viewModel: vm, presentation }: { viewModel: ModelPromptingViewModel; presentation: CinematicPresentation }) {
  const { content, assets, examples, ui, assistantHref } = presentation;
  const panel = examples.panels.find(item => item.placement === 'prompting')!;
  const asset = assets.find(item => item.id === panel.assetIds[0])!;
  const plan = examples.shotPlans?.find(item => item.assetId === asset.id);
  const prompt = plan ? `${ui.animateFrame} ${plan.motion}\n${ui.sound}: ${plan.sound}` : asset.prompt;
  return <section id="prompting" className="cinema-prompting cinema-section"><div className="cinema-wrap">
    <header className="cinema-section-heading"><div><p className="cinema-eyebrow">{content.promptingLabel}</p><h2>{vm.section.title}</h2></div><p>{vm.section.intro}</p></header>
    <div className="cinema-prompt-lab">
      <div className="cinema-prompt-proof"><ModelCinematicAsset asset={asset} ui={ui} plan={plan} compact />
        <ModelDecisionCopyButton copyText={prompt} label={plan ? ui.copyVideo : ui.copy} copiedLabel={ui.copied} />
      </div>
      <div className="cinema-prompt-method">
        <div className="cinema-workflow">{vm.referenceWorkflows.map((item, index) => <article key={item.title}><span className="cinema-step">{String(index + 1).padStart(2, '0')}</span><h3>{item.title}</h3><p>{item.body}</p></article>)}</div>
        <ModelCinematicPromptAssistant copy={content.promptAssistant} href={assistantHref} />
        <details className="cinema-disclosure"><summary>{vm.ui.global}<span aria-hidden="true">+</span></summary><div><ul>{vm.globalPrinciples.map(item => <li key={item}>{item}</li>)}</ul>{vm.section.tip ? <p>{vm.section.tip}</p> : null}</div></details>
        {vm.section.guide ? <a className="cinema-source-link" href={vm.section.guide.href} target="_blank" rel="noopener noreferrer">{vm.section.guide.label} ↗</a> : null}
      </div>
    </div>
    {vm.tabs.items.length ? <div className="cinema-recipes">{vm.tabs.items.map(item => <details className="cinema-disclosure" key={item.id}><summary>{item.title}<span aria-hidden="true">+</span></summary><div><p>{item.description}</p><p>{item.copy}</p><div className="cinema-actions"><ModelDecisionCopyButton copyText={item.copy} label={vm.ui.copyPrompt} copiedLabel={vm.ui.copied} />{item.exampleLinks?.usePromptHref ? <Link href={item.exampleLinks.usePromptHref} prefetch={false}>{vm.ui.usePrompt} ↗</Link> : null}</div></div></details>)}</div> : null}
  </div></section>;
}
