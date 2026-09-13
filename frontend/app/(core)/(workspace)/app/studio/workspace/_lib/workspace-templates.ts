export {
  DEFAULT_WORKSPACE_TEMPLATE_SHOT_MODEL_ID,
  WORKSPACE_EDGE_COLORS,
  createWorkspaceEdge,
  edgeLabel,
  inferWorkspaceEdgeKind,
} from './templates/template-core';
export { createProductAdWorkspaceTemplate } from './templates/product-ad';
export { createGuidedProjectStarterTemplate } from './templates/guided-project-starters';
export { createDevBlocksWorkspaceTemplate } from './templates/dev-blocks';
export {
  MINIMAL_START_PROMPT_NODE_ID,
  MINIMAL_START_VIDEO_NODE_ID,
  MINIMAL_START_WORKSPACE_TEMPLATE_ID,
  createMinimalStartWorkspaceTemplate,
} from './templates/minimal-start';
export {
  WORKSPACE_TEMPLATE_REGISTRY,
  WORKSPACE_TEMPLATE_SUMMARIES,
  createStarterWorkspaceTemplate,
  isWorkspaceTemplateId,
} from './templates/registry';
export type { WorkspaceTemplateBuildCopy } from './templates/registry';
