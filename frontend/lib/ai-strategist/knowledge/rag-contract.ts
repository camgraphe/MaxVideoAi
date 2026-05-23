export type StrategistRagSearchInput = {
  query: string;
  allowedSourceIds: string[];
  maxResults: number;
};

export type StrategistRagSearchResult = {
  excerpt: string;
  sourceId: string;
  sourcePath?: string;
  sourceUrl?: string;
  confidence: number;
};

export const AI_STRATEGIST_RAG_ENABLED = false;

export const AI_STRATEGIST_ALLOWED_RAG_SOURCE_IDS = [
  'ai-strategist-model-docs',
  'ai-strategist-workflow-docs',
  'ai-strategist-prompt-structure-docs',
  'selected-public-site-docs',
  'selected-public-examples-metadata',
] as const;
