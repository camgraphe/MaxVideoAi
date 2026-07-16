import type { ModelExamplesViewModel } from '../_lib/model-page-examples-view-model';
import { ModelDecisionExamplesSection } from './ModelDecisionExamplesSection';
import { ModelDefaultExamplesSection } from './ModelDefaultExamplesSection';

export function ModelExamplesSection({
  viewModel,
  variant = 'default',
}: {
  viewModel: ModelExamplesViewModel;
  variant?: 'default' | 'decision';
}) {
  if (!viewModel.visible) return null;

  return variant === 'decision'
    ? <ModelDecisionExamplesSection viewModel={viewModel} />
    : <ModelDefaultExamplesSection viewModel={viewModel} />;
}
