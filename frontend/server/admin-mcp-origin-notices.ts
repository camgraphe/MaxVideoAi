// These are quote counts before the window end, matching cumulative account activity.
export function mcpQuoteOriginNotices(studio: number, toolbox: number, unknown: number): string[] {
  return studio + toolbox + unknown > 0 ? [
    `Only OAuth MCP quotes contribute to outcomes. Quotes excluded before the window end (including cumulative account activity): Studio: ${studio}; Toolbox: ${toolbox}; Unknown origin: ${unknown}.`,
  ] : [];
}
