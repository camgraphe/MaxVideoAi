export const MAXVIDEOAI_PUBLIC_PLUGIN_VERSION = '0.3.3' as const;
export const MAXVIDEOAI_PUBLIC_PLUGIN_SOURCE_TAG =
  `v${MAXVIDEOAI_PUBLIC_PLUGIN_VERSION}` as const;

export const MAXVIDEOAI_CODEX_MARKETPLACE_ADD_COMMAND =
  `codex plugin marketplace add camgraphe/maxvideoai-plugin --ref ${MAXVIDEOAI_PUBLIC_PLUGIN_SOURCE_TAG}` as const;
export const MAXVIDEOAI_CODEX_PLUGIN_ADD_COMMAND =
  'codex plugin add maxvideoai@maxvideoai' as const;
