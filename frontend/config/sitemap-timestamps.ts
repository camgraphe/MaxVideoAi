export type SitemapTimestampConfig = {
  /**
   * Manual timestamps for sitemap files. Keys must match the file name served at the domain root
   * (e.g. "sitemap-video.xml"). Values must be ISO `YYYY-MM-DD` strings.
   */
  sitemaps?: Record<string, string>;
  /**
   * Manual timestamps for specific canonical routes (english paths such as "/pricing").
   * Values must be ISO `YYYY-MM-DD` strings.
   */
  routes?: Record<string, string>;
};

export const SITEMAP_MANUAL_TIMESTAMPS: SitemapTimestampConfig = {
  sitemaps: {
    'sitemap-en.xml': '2026-09-03',
    'sitemap-fr.xml': '2026-09-03',
    'sitemap-es.xml': '2026-09-03',
    'sitemap-models.xml': '2026-09-03',
  },
  routes: {
    '/models': '2026-09-03',
    '/pricing': '2026-09-03',
    '/pay-as-you-go-ai-video-generator': '2026-09-03',
    '/ai-video-engines': '2026-09-03',
    '/models/gemini-omni-flash': '2026-09-03',
    '/models/kling-3-turbo-standard': '2026-09-03',
    '/models/kling-3-turbo-pro': '2026-09-03',
    '/models/minimax-h3-max': '2026-09-03',
    '/ai-video-engines/minimax-h3-vs-minimax-h3-max': '2026-09-03',
    '/ai-video-engines/kling-3-turbo-pro-vs-kling-3-turbo-standard': '2026-09-03',
    '/ai-video-engines/kling-3-pro-vs-kling-3-turbo-pro': '2026-09-03',
    '/ai-video-engines/gemini-omni-flash-vs-kling-3-turbo-pro': '2026-09-03',
    '/ai-video-engines/gemini-omni-flash-vs-veo-3-1': '2026-09-03',
    '/models/wan-3': '2026-09-02',
    '/models/wan-3-prime': '2026-09-02',
    '/models/ltx-2-5-fast': '2026-09-02',
    '/models/ltx-2-5-pro': '2026-09-02',
    '/models/grok-imagine-video-1-5': '2026-09-02',
    '/models/flux-3': '2026-09-02',
    '/models/flux-3-draft': '2026-09-02',
    '/examples/wan': '2026-09-02',
    '/examples/ltx': '2026-09-02',
    '/examples/grok': '2026-09-02',
    '/examples/flux': '2026-09-02',
    '/ai-video-engines/ltx-2-3-pro-vs-ltx-2-5-pro': '2026-09-02',
    '/ai-video-engines/ltx-2-3-fast-vs-ltx-2-5-fast': '2026-09-02',
    '/ai-video-engines/ltx-2-5-fast-vs-ltx-2-5-pro': '2026-09-02',
    '/ai-video-engines/wan-2-6-vs-wan-3': '2026-09-02',
    '/ai-video-engines/wan-3-vs-wan-3-prime': '2026-09-02',
    '/ai-video-engines/flux-3-vs-flux-3-draft': '2026-09-02',
    '/ai-video-engines/grok-imagine-video-1-5-vs-sora-2': '2026-09-02',
    '/ai-video-engines/flux-3-vs-grok-imagine-video-1-5': '2026-09-02',
    '/models/minimax-h3': '2026-08-08',
    '/ai-video-engines/minimax-h3-vs-seedance-2-5': '2026-08-08',
    '/ai-video-engines/kling-o3-pro-vs-minimax-h3': '2026-08-08',
    '/ai-video-engines/minimax-h3-vs-veo-3-1': '2026-08-08',
    '/ai-video-engines/best-for/cinematic-realism': '2026-08-08',
    '/ai-video-engines/best-for/character-reference': '2026-08-08',
    '/ai-video-engines/best-for/reference-to-video': '2026-08-08',
    '/ai-video-engines/best-for/multi-shot-video': '2026-08-08',
    '/ai-video-engines/best-for/4k-video': '2026-08-08',
    '/ai-video-engines/best-for/lipsync-dialogue': '2026-08-08',
  },
};
