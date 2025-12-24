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
  sitemaps: {},
  routes: {
    // Example: '/pricing': '2024-11-15',
  },
};
