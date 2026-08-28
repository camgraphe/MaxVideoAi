export type McpActivityMetrics = {
  connectedUsers: number;
  newConnectedUsers: number;
  returningConnectedUsers: number;
  connectionEvents: number;
  activeToolUsers: number;
  toolCalls: number;
  successfulToolCalls: number;
  failedToolCalls: number;
  toolSuccessRate: number | null;
};

export type McpActivitySummaryRow = Record<
  | 'connected_users'
  | 'new_connected_users'
  | 'connection_events'
  | 'active_tool_users'
  | 'tool_calls'
  | 'successful_tool_calls'
  | 'failed_tool_calls'
  | 'polling_calls'
  | 'upload_failures'
  | 'refund_restoration_failures',
  number | string | null
>;

export type McpToolUsage = {
  tool: string;
  calls: number;
  users: number;
  failures: number;
  successRate: number | null;
};

export type McpToolUsageSummaryRow = {
  tool: string | null;
  calls: number | string | null;
  users: number | string | null;
  failures: number | string | null;
};

function aggregateCount(value: number | string | null | undefined): number {
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (!Number.isSafeInteger(parsed) || (parsed as number) < 0) {
    throw new Error('Invalid MCP activity aggregate count.');
  }
  return parsed as number;
}

export function buildMcpActivityMetrics(row: McpActivitySummaryRow): McpActivityMetrics {
  const connectedUsers = aggregateCount(row.connected_users);
  const newConnectedUsers = aggregateCount(row.new_connected_users);
  if (newConnectedUsers > connectedUsers) throw new Error('Invalid MCP connection cohort aggregate.');
  const toolCalls = aggregateCount(row.tool_calls);
  const successfulToolCalls = aggregateCount(row.successful_tool_calls);
  const failedToolCalls = aggregateCount(row.failed_tool_calls);
  if (successfulToolCalls + failedToolCalls !== toolCalls) {
    throw new Error('Invalid MCP tool-call outcome aggregate.');
  }
  return {
    connectedUsers,
    newConnectedUsers,
    returningConnectedUsers: connectedUsers - newConnectedUsers,
    connectionEvents: aggregateCount(row.connection_events),
    activeToolUsers: aggregateCount(row.active_tool_users),
    toolCalls,
    successfulToolCalls,
    failedToolCalls,
    toolSuccessRate: toolCalls === 0 ? null : successfulToolCalls / toolCalls,
  };
}

export function buildMcpToolUsage(rows: McpToolUsageSummaryRow[]): McpToolUsage[] {
  return rows.map((row) => {
    if (typeof row.tool !== 'string' || row.tool.length < 1 || row.tool.length > 128) {
      throw new Error('Invalid MCP tool usage name.');
    }
    const calls = aggregateCount(row.calls);
    const users = aggregateCount(row.users);
    const failures = aggregateCount(row.failures);
    if (users > calls || failures > calls) throw new Error('Invalid MCP tool usage aggregate.');
    return {
      tool: row.tool,
      calls,
      users,
      failures,
      successRate: calls === 0 ? null : (calls - failures) / calls,
    };
  });
}
