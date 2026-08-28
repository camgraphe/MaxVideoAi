export const MAXVIDEOAI_PUBLIC_PLUGIN_VERSION = '0.3.1' as const;
export const MAXVIDEOAI_PUBLIC_PLUGIN_SOURCE_TAG =
  `maxvideoai-plugin-v${MAXVIDEOAI_PUBLIC_PLUGIN_VERSION}` as const;

export const MAXVIDEOAI_CODEX_MARKETPLACE_ADD_COMMAND =
  `codex plugin marketplace add camgraphe/MaxVideoAi --ref ${MAXVIDEOAI_PUBLIC_PLUGIN_SOURCE_TAG}` as const;
export const MAXVIDEOAI_CODEX_PLUGIN_ADD_COMMAND =
  'codex plugin add maxvideoai@maxvideoai' as const;
