export type StrategistTranscriptScoreInput = {
  userMessage: string;
  assistantMessage: string;
  task: string;
  action: string;
  stage: string;
};

export type StrategistFailureInput = {
  owner: string;
  message: string;
};

export function scoreStrategistTranscript(input: StrategistTranscriptScoreInput) {
  const issues: string[] = [];
  let score = 10;
  const user = normalize(input.userMessage);
  const assistant = normalize(input.assistantMessage);

  if (/^(hi|hello|hey|bonjour|hola)$/.test(user) && assistant.includes('what video are you trying')) {
    score -= 3;
    issues.push('generic clarification after greeting');
  }

  if ((user.includes('cheapest') || user.includes('lowest cost')) && !assistant.includes('$')) {
    score -= 3;
    issues.push('pricing question without price anchor');
  }

  if ((user.includes('choose for me') || user.includes('you decide')) && input.stage === 'awaiting_model_choice') {
    score -= 4;
    issues.push('failed to act on user delegation');
  }

  if (assistant.includes('normalizedbrief') || assistant.includes('orchestration') || assistant.includes('json')) {
    score -= 2;
    issues.push('technical implementation language exposed');
  }

  if (!containsAny(assistant, ['credit', 'generation', 'prompt', 'model', 'workflow', 'example', 'price', 'quote'])) {
    score -= 1;
    issues.push('weak funnel progression');
  }

  return {
    score: Math.max(0, score),
    issues,
  };
}

export function clusterStrategistFailures(failures: StrategistFailureInput[]) {
  const byOwner = new Map<string, StrategistFailureInput[]>();
  for (const failure of failures) {
    byOwner.set(failure.owner, [...(byOwner.get(failure.owner) ?? []), failure]);
  }

  return Array.from(byOwner.entries())
    .map(([owner, ownerFailures]) => ({
      owner,
      count: ownerFailures.length,
      examples: ownerFailures.slice(0, 5).map((failure) => failure.message),
    }))
    .sort((a, b) => b.count - a.count || a.owner.localeCompare(b.owner));
}

function containsAny(value: string, needles: readonly string[]) {
  return needles.some((needle) => value.includes(needle));
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
