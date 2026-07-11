export type AgentPrincipal = {
  userId: string;
  clientId: string | null;
  emailVerified: boolean;
  authMethod: 'oauth';
};
