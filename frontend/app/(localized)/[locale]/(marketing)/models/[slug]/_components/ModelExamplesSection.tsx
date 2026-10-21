import type { ModelExamplesViewModel } from '../_lib/model-page-examples-view-model';
import { ModelDecisionExamplesSection } from './ModelDecisionExamplesSection';
import { ModelDefaultExamplesSection } from './ModelDefaultExamplesSection';
import { ModelKeyframeDemoSection } from './ModelKeyframeDemoSection';
import type { ModelKeyframeDemoViewModel } from '../_lib/model-page-keyframe-demo';

export function ModelExamplesSection({
  viewModel,
  variant = 'default',
  keyframeDemo,
}: {
  viewModel: ModelExamplesViewModel;
  variant?: 'default' | 'decision';
  keyframeDemo?: ModelKeyframeDemoViewModel | null;
}) {
  if (!viewModel.visible && !keyframeDemo) return null;

  return <>
    {viewModel.visible ? variant === 'decision'
      ? <ModelDecisionExamplesSection viewModel={viewModel} />
      : <ModelDefaultExamplesSection viewModel={viewModel} /> : null}
    {keyframeDemo ? <ModelKeyframeDemoSection viewModel={keyframeDemo} /> : null}
  </>;
}
