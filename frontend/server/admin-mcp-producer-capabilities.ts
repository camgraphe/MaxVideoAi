export type McpMetricProducerCapabilities = Readonly<{
  funnel: boolean;
  audit: boolean;
  recommendationToQuote: boolean;
  receipts: boolean;
  providerCosts: boolean;
  polling: boolean;
  uploads: boolean;
  restorations: boolean;
}>;

export const MCP_METRIC_PRODUCER_CAPABILITIES: McpMetricProducerCapabilities = Object.freeze({
  funnel: false,
  audit: true,
  recommendationToQuote: false,
  receipts: false,
  providerCosts: false,
  polling: false,
  uploads: false,
  restorations: false,
});
