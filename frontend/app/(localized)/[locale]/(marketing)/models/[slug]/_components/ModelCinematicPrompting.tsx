import { Link } from '@/i18n/navigation';
import type { CinematicAsset } from '../_lib/model-page-cinematic-data';
import type { ModelPromptingViewModel } from '../_lib/model-page-prompting-view-model';
import { ModelDecisionCopyButton } from './ModelDecisionCopyButton.client';

export function ModelCinematicPrompting({ viewModel: vm, assets, label }: { viewModel: ModelPromptingViewModel; assets: CinematicAsset[]; label: string }) {
  // Exact prompts already accompany the photographs. Do not repeat them in another gallery.
  const recipes = vm.tabs.items.map(tab => ({ id: tab.id, title: tab.title, body: tab.description, prompt: tab.copy, href: tab.exampleLinks?.usePromptHref }));
  const additional = vm.imageExamples?.items.filter(item => !assets.some(asset => asset.id === item.id && asset.prompt === item.prompt)) ?? [];
  return <section id="prompting" className="cinema-prompting cinema-section"><div className="cinema-wrap">
    <header className="cinema-section-heading"><div><p className="cinema-eyebrow">{label}</p><h2>{vm.section.title}</h2></div><p>{vm.section.intro}</p></header>
    <div className="cinema-workflow">{vm.referenceWorkflows.map((item, index) => <article key={item.title}><span className="cinema-step">{String(index + 1).padStart(2, '0')}</span><h3>{item.title}</h3><p>{item.body}</p></article>)}</div>
    {recipes.length || additional.length ? <div className="cinema-recipes">{[...recipes, ...additional.map(item => ({ id: item.id, title: item.title, body: item.badge, prompt: item.prompt, href: vm.imageExamples?.workspaceHref }))].map(item => <details className="cinema-disclosure" key={item.id}><summary>{item.title}<span aria-hidden="true">+</span></summary><div><p>{item.body}</p><p>{item.prompt}</p><div className="cinema-actions"><ModelDecisionCopyButton copyText={item.prompt} label={vm.ui.copyPrompt} copiedLabel={vm.ui.copied} />{item.href ? <Link href={item.href} prefetch={false}>{vm.ui.usePrompt} ↗</Link> : null}</div></div></details>)}</div> : null}
    <details className="cinema-disclosure"><summary>{vm.ui.global}<span aria-hidden="true">+</span></summary><div><ul>{vm.globalPrinciples.map(item => <li key={item}>{item}</li>)}</ul>{vm.section.tip ? <p>{vm.section.tip}</p> : null}</div></details>
    {vm.section.guide ? <a className="cinema-source-link" href={vm.section.guide.href} target="_blank" rel="noopener noreferrer">{vm.section.guide.label} ↗</a> : null}
  </div></section>;
}
