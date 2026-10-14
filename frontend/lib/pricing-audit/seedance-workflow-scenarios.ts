import { buildManualTariffCoverageScenario, type ManualTariffCoverageScenario } from './manual-tariff-coverage';

/** Separate admin/preparation inventory; unavailable workflow modes are not public catalogue offers. */
export function seedanceWorkflowScenarios(normal: readonly ManualTariffCoverageScenario[]): ManualTariffCoverageScenario[] {
  const contexts = normal.filter(s => s.modelId === 'seedance-2-5' && ['t2v', 'i2v', 'ref2v', 'v2v', 'extend'].includes(s.context.mode ?? '')
    && (['480p', '1080p'].includes(s.context.resolution) || (s.context.mode === 'v2v' && s.context.resolution === '720p')))
    .map(s => ({ ...s.context, resolution: s.context.resolution === '720p' ? '1080p' : s.context.resolution }));
  return [...new Map(contexts.map(context => {
    const workflowStep = context.resolution === '480p' ? 'draft' : 'final';
    const scenario = buildManualTariffCoverageScenario({ ...context, workflowStep }, `seedance-2-5:${workflowStep}`);
    return [scenario.id, scenario] as const;
  })).values()];
}
