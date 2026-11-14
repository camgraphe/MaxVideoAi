import type { ModelExamplesViewModel } from '../_lib/model-page-examples-view-model';
import { ModelDecisionExamplesSection } from './ModelDecisionExamplesSection';
import { ModelDefaultExamplesSection } from './ModelDefaultExamplesSection';
import { ModelKeyframeDemoSection } from './ModelKeyframeDemoSection';
import type { ModelKeyframeDemoViewModel } from '../_lib/model-page-keyframe-demo';
import type { ModelEditorialImage } from '../_lib/model-page-editorial-images';
import { ModelEditorialImageGallery } from './ModelEditorialImageGallery.client';
import { ModelCinematicExamples } from './ModelCinematicExamples';
import type { CinematicPresentation } from '../_lib/model-page-cinematic-data';

export function ModelExamplesSection({
  viewModel,
  variant = 'default',
  keyframeDemo,
  editorialImages = [],
  cinematic,
  hasRenderedVideos = false,
}: {
  viewModel: ModelExamplesViewModel;
  variant?: 'default' | 'decision';
  keyframeDemo?: ModelKeyframeDemoViewModel | null;
  editorialImages?: ModelEditorialImage[];
  cinematic?: CinematicPresentation | null;
  hasRenderedVideos?: boolean;
}) {
  if (cinematic) return <ModelCinematicExamples presentation={cinematic} viewModel={viewModel} hasRenderedVideos={hasRenderedVideos} />;
  if (editorialImages.length) return <ModelEditorialImageGallery images={editorialImages}
    title={viewModel.section.title} intro={viewModel.section.intro} anchorId={viewModel.anchorId}
    workspaceLabel={viewModel.section.recreateLabel} afterGallery={viewModel.section.afterGallery}
    videoWorkflowLabel={viewModel.section.videoWorkflowLabel}/>;
  if (!viewModel.visible && !keyframeDemo) return null;

  return <>
    {viewModel.visible ? variant === 'decision'
      ? <ModelDecisionExamplesSection viewModel={viewModel} />
      : <ModelDefaultExamplesSection viewModel={viewModel} /> : null}
    {keyframeDemo ? <ModelKeyframeDemoSection viewModel={keyframeDemo} /> : null}
  </>;
}
