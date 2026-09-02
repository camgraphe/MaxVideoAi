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
    'sitemap-en.xml': '2026-09-02',
    'sitemap-fr.xml': '2026-09-02',
    'sitemap-es.xml': '2026-09-02',
    'sitemap-models.xml': '2026-09-02',
    'sitemap-video.xml': '2026-09-02',
    'sitemap-video-pages.xml': '2026-09-02',
  },
  routes: {
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
    '/video/wan-3-alpine-runner-multishot': '2026-09-02',
    '/video/wan-3-prime-chef-multishot': '2026-09-02',
    '/video/ltx-2-5-fast-street-rhythm': '2026-09-02',
    '/video/ltx-2-5-pro-lantern-release': '2026-09-02',
    '/video/grok-1-5-lunar-barista': '2026-09-02',
    '/video/flux-3-season-shifting-station': '2026-09-02',
    '/video/flux-3-draft-neon-cyclist': '2026-09-02',
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
