export function isAiStrategistBetaApiEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== 'production' || env.AI_STRATEGIST_BETA_API_ENABLED === '1' || env.AI_STRATEGIST_BETA_ENABLED === '1';
}

export function isAiStrategistBetaWidgetEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_AI_STRATEGIST_BETA_ENABLED === '1';
}
