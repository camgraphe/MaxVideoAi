import { cinematicVideoPromptLinks, cinematicRecipeLinks } from '../_lib/model-page-workflow-proofs';
import { Link } from '@/i18n/navigation';
import NextLink from 'next/link';
import type { ModelPromptingViewModel } from '../_lib/model-page-prompting-view-model';
import type { CinematicPresentation } from '../_lib/model-page-cinematic-data';
import { ModelDecisionCopyButton } from './ModelDecisionCopyButton.client';
import { ModelCinematicPromptAssistant } from './ModelCinematicPromptAssistant';
import { ModelCinematicAsset } from './ModelCinematicAsset';
import { ModelCinematicPromptRecipe } from './ModelCinematicPromptRecipe';
import { ModelCinematicVideoPrompt } from './ModelCinematicVideoPrompt.client';
import { CinematicArrow, CinematicPlus } from './ModelCinematicMarks';

export function ModelCinematicPrompting({ viewModel: vm, presentation }: { viewModel: ModelPromptingViewModel; presentation: CinematicPresentation }) {
  const { content, assets, examples, ui, assistantHref } = presentation;
  const panel = examples.panels.find(item => item.placement === 'prompting');
  const asset = assets.find(item => item.id === panel?.assetIds[0]);
  const plan = examples.shotPlans?.find(item => item.assetId === asset?.id);
  const prompt = plan ? plan.prompt ?? vm.demo?.prompt ?? `${ui.animateFrame} ${plan.motion}\n${ui.sound}: ${plan.sound}` : asset?.prompt;
  const videoDetails = asset && plan && prompt && content.workflows ? <ModelCinematicVideoPrompt title={asset.title} prompt={prompt} note={plan.proofNote ?? content.workflows.promptNote} imageDetailsLabel={content.workflows.imageDetailsLabel} ui={ui} asset={asset.video ? undefined : asset} creation={asset.videoCreation ?? cinematicVideoPromptLinks(assistantHref, asset.id)} /> : undefined;
  return <section id="prompting" className="cinema-prompting cinema-section"><div className="cinema-wrap">
    <header className="cinema-section-heading"><div><p className="cinema-eyebrow">{content.promptingLabel}</p><h2>{vm.section.title}</h2></div><p>{vm.section.intro}</p></header>
    <div className={asset ? 'cinema-prompt-lab' : undefined}>
      {asset && prompt ? <div className="cinema-prompt-proof"><ModelCinematicAsset asset={asset} ui={ui} plan={plan} compact details={videoDetails} />
        {!plan ? <div className="cinema-prompt-reuse">
          {!plan && asset.creation ? <NextLink href={asset.creation.href} prefetch={false} className="cinema-button" data-analytics-event="cta_click" data-analytics-cta-name="reuse_example" data-analytics-cta-location="model_prompt_guide" data-analytics-target-family="workspace">{ui.reuse}<CinematicArrow /></NextLink> : null}
          <ModelDecisionCopyButton copyText={prompt} label={plan ? ui.copyVideo : ui.copy} copiedLabel={ui.copied} analyticsLocation="model_prompt_guide" />
          {!plan && asset.creation ? <NextLink href={asset.creation.refineHref} prefetch={false} className="cinema-source-link" data-analytics-event="cta_click" data-analytics-cta-name="milo_try" data-analytics-cta-location="model_prompt_guide" data-analytics-target-family="workspace">{ui.refine}<CinematicArrow direction="external" /></NextLink> : null}
        </div> : null}
        {plan && vm.recipe ? <p className="cinema-prompt-scene">{vm.recipe.excerpt}</p> : null}
      </div> : null}
      <div className="cinema-prompt-method">
        {vm.recipe ? <ModelCinematicPromptRecipe recipe={vm.recipe} excerpt={!plan} /> : <div className="cinema-workflow">{vm.referenceWorkflows.map((item, index) => <article key={item.title}><span className="cinema-step">{String(index + 1).padStart(2, '0')}</span><h3>{item.title}</h3><p>{item.body}</p></article>)}</div>}
      </div>
    </div>
    <ModelCinematicPromptAssistant copy={content.promptAssistant} href={assistantHref} />
    <div className="cinema-prompt-followup"><details className="cinema-disclosure"><summary>{vm.ui.global}<CinematicPlus /></summary><div>
      {vm.recipe ? <div className="cinema-prompt-notes">{vm.referenceWorkflows.map(item => <article key={item.title}><h3>{item.title}</h3><p>{item.body}</p></article>)}</div> : null}
      <ul>{vm.globalPrinciples.map(item => <li key={item}>{item}</li>)}</ul>{vm.section.tip ? <p>{vm.section.tip}</p> : null}
      {vm.tabs.items.length ? <div className="cinema-prompt-recipes"><h3>{ui.promptLibrary}</h3>{vm.tabs.items.map(item => <article key={item.id}>
        <ModelCinematicVideoPrompt title={item.title} triggerLabel={item.title} prompt={item.copy}
          note={[item.description, vm.tabs.notesById[item.id]].filter(Boolean).join(' ')} imageDetailsLabel={ui.sourcePrompt}
          ui={item.matchPublicExample ? ui : { ...ui, videoPrompt: ui.promptTemplate, copyVideo: vm.ui.copyTemplate }}
          creation={cinematicRecipeLinks(item.exampleLinks?.usePromptHref, presentation.locale)} />
        {item.exampleLinks?.exampleHref ? <Link href={item.exampleLinks.exampleHref} prefetch={false} className="cinema-source-link">{vm.ui.viewRender}<CinematicArrow /></Link> : null}
      </article>)}</div> : null}
    </div></details>{vm.section.guide ? <a className="cinema-source-link" href={vm.section.guide.href} target="_blank" rel="noopener noreferrer">{vm.section.guide.label} ↗</a> : null}</div>

  </div></section>;
}
