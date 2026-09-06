import { getSupabaseAdmin } from '@/server/supabase-admin';
import { classifyMcpClient } from '@/server/mcp/client-family';

export type McpAuthMetadata = {
  profiles: Array<{ user_id: string; registered_at: string }>;
  clients: Array<{ oauth_client_id: string; family: 'chatgpt' | 'claude' | 'codex' }>;
};

// Bounded, read-only fallback for unsynchronized profiles and legacy client attribution.
// No account details, raw client names or client secrets leave this server module.
export async function readMcpAuthMetadata(
  userIds: string[],
  clientIds: string[],
  getAdmin = getSupabaseAdmin,
): Promise<McpAuthMetadata> {
  const result: McpAuthMetadata = { profiles: [], clients: [] };
  if (userIds.length + clientIds.length > 100) return result;
  try {
    const admin = getAdmin();
    const reads = [
      ...userIds.map((userId) => async () => {
        const { data, error } = await admin.auth.admin.getUserById(userId);
        const createdAt = data.user?.created_at;
        if (!error && data.user?.id === userId && createdAt && Number.isFinite(Date.parse(createdAt))) {
          result.profiles.push({ user_id: userId, registered_at: createdAt });
        }
      }),
      ...clientIds.map((clientId) => async () => {
        const { data, error } = await admin.auth.admin.oauth.getClient(clientId);
        if (error || !data || data.client_id !== clientId) return;
        const family = classifyMcpClient({ params: { clientInfo: { name: data.client_name } } });
        if (family !== 'other') result.clients.push({ oauth_client_id: clientId, family });
      }),
    ];
    for (let offset = 0; offset < reads.length; offset += 4) {
      await Promise.allSettled(reads.slice(offset, offset + 4).map((read) => read()));
    }
  } catch {
    // Auth availability must not remove independently measured video outcomes.
  }
  return result;
}
