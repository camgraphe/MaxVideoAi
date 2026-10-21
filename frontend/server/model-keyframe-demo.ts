import manifest from '@/config/model-keyframe-demos.json';
import { projectPublicKeyframeDemo, type ModelKeyframeDemoSelection } from '@/lib/public-keyframe-demo';
import { getSeoVideoById } from '@/server/videos';

type Dependencies = { selections?: readonly ModelKeyframeDemoSelection[]; readVideo?: typeof getSeoVideoById };

/** Empty selection costs no database read and never exposes a placeholder. */
export async function loadModelKeyframeDemo(modelSlug: string, dependencies: Dependencies = {}) {
  const selection = (dependencies.selections ?? manifest.demos).find(item => item.modelSlug === modelSlug);
  if (!selection) return null;
  const video = await (dependencies.readVideo ?? getSeoVideoById)(selection.jobId);
  return projectPublicKeyframeDemo(video, selection);
}

export async function loadPublicKeyframeRecipeForVideo(jobId: string, modelSlug: string) {
  if (!manifest.demos.some((item: ModelKeyframeDemoSelection) => item.jobId === jobId && item.modelSlug === modelSlug)) return null;
  const demo = await loadModelKeyframeDemo(modelSlug);
  return demo?.recipe.jobId === jobId ? demo.recipe : null;
}
