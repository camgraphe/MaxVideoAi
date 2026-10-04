import { buildManualTariffCoverageScenario, type ManualTariffCoverageScenario } from './manual-tariff-coverage';

/** Separate admin/preparation inventory; unavailable workflow modes are not public catalogue offers. */
export function seedanceWorkflowScenarios(normal: readonly ManualTariffCoverageScenario[]): ManualTariffCoverageScenario[] {
  return normal.filter(s => s.modelId === 'seedance-2-5' && s.context.mode === 't2v'
    && ['480p', '1080p'].includes(s.context.resolution)).map(s => {
    const workflowStep = s.context.resolution === '480p' ? 'draft' : 'final';
    return buildManualTariffCoverageScenario({ ...s.context, workflowStep }, `seedance-2-5:${workflowStep}`);
  });
}
