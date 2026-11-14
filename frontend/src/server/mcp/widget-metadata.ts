import { MCP_OPENAI_DIRECTORY_RESOURCE_URL } from '@/lib/mcp-host-routing';

// The plugin's reserved origin is shared by its components, independently of
// the account website. This declaration does not activate DNS or deploy a host.
export const MAXVIDEOAI_WIDGET_DOMAIN = new URL(MCP_OPENAI_DIRECTORY_RESOURCE_URL).origin;
