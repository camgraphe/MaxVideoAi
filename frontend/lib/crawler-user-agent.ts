const CRAWLER_USER_AGENT_PATTERN =
  /bot|crawler|spider|crawling|lighthouse|Googlebot|Google-InspectionTool|Bingbot|DuckDuckBot|Applebot|YandexBot|facebookexternalhit|Twitterbot/i;

export function isCrawlerUserAgent(userAgent: string): boolean {
  return CRAWLER_USER_AGENT_PATTERN.test(userAgent);
}
