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
    'sitemap-en.xml': '2026-08-08',
    'sitemap-fr.xml': '2026-08-08',
    'sitemap-es.xml': '2026-08-08',
    'sitemap-models.xml': '2026-08-08',
  },
  routes: {
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
