import type { PricingPolicyRule } from '@maxvideoai/pricing';

import type {
  PricingChangeEvent,
  PricingChangeJsonObject,
  PricingChangeJsonValue,
} from '@/lib/admin/pricing-change-contract';

import { PricingAdminError } from './errors';
import type {
  PricingChangeConfirmation,
  PricingChangePreview,
  PricingPolicyChangeProposal,
  PricingPolicyServiceDependencies,
} from './policy-contract';
import { DEFAULT_POLICY_SERVICE_DEPENDENCIES } from './policy-dependencies';
import { previewPricingPolicyChange } from './policy-preview';
import { jsonRule, requiredText } from './policy-rules';

function previewSummary(
  preview: PricingChangePreview
): PricingChangeJsonObject {
  const deltas = preview.rows.map((row) => row.deltaCents);
  return {
    previewFingerprint: preview.previewFingerprint,
    affectedSurfaces: preview.affectedSurfaces,
    rowCount: preview.rows.length,
    deltaCents: preview.rows.reduce(
      (sum, row) => sum + row.deltaCents,
      0
    ),
    minimumDeltaCents: deltas.length ? Math.min(...deltas) : 0,
    maximumDeltaCents: deltas.length ? Math.max(...deltas) : 0,
    ...(preview.rollbackEventId
      ? { rollbackEventId: preview.rollbackEventId }
      : {}),
  };
}

export async function confirmPricingPolicyChange(
  proposal: PricingPolicyChangeProposal,
  fingerprint: string,
  actorId: string,
  dependencies: PricingPolicyServiceDependencies =
    DEFAULT_POLICY_SERVICE_DEPENDENCIES
): Promise<PricingChangeConfirmation> {
  const serverActorId = requiredText(actorId, 'actorId');
  const preview = await previewPricingPolicyChange(
    proposal,
    dependencies
  );
  if (!fingerprint || preview.previewFingerprint !== fingerprint) {
    throw new PricingAdminError(
      'preview_stale',
      'Pricing preview is stale; review the current impact again'
    );
  }

  let result: {
    persistedState: PricingChangeJsonValue | null;
    event: PricingChangeEvent;
  };
  try {
    result = await dependencies.withTransaction(async (executor) => {
      const transactionDependencies: PricingPolicyServiceDependencies = {
        ...dependencies,
        loadOverrides: () => dependencies.loadOverrides(executor),
        getEvent: (id, domain) =>
          dependencies.getEvent(id, domain, executor),
      };
      const transactionPreview = await previewPricingPolicyChange(
        proposal,
        transactionDependencies
      );
      if (transactionPreview.previewFingerprint !== fingerprint) {
        throw new PricingAdminError(
          'preview_stale',
          'Pricing preview became stale before persistence'
        );
      }
      let persistedState: PricingChangeJsonValue | null;
      if (transactionPreview.proposedState === null) {
        await dependencies.deleteRule(
          executor,
          transactionPreview.targetId
        );
        persistedState = null;
      } else {
        const persisted = await dependencies.upsertRule(
          executor,
          transactionPreview.proposedState as unknown as PricingPolicyRule,
          serverActorId
        );
        persistedState = jsonRule(persisted);
      }
      const event = await dependencies.insertEvent(executor, {
        domain: 'policy_rule',
        operation: transactionPreview.operation,
        targetId: transactionPreview.targetId,
        actorId: serverActorId,
        previousState: transactionPreview.currentState,
        nextState: transactionPreview.proposedState,
        previewSummary: previewSummary(transactionPreview),
        affectedScenarioIds: transactionPreview.affectedScenarioIds,
      });
      return { persistedState, event };
    });
  } catch (error) {
    if (error instanceof PricingAdminError) throw error;
    throw new PricingAdminError(
      'persistence_failed',
      'Failed to persist pricing policy change'
    );
  }

  const operationalWarnings:
    PricingChangeConfirmation['operationalWarnings'] = [];
  try {
    dependencies.invalidateCache();
  } catch {
    operationalWarnings.push({
      code: 'cache_invalidation_failed',
      message:
        'Pricing change committed; in-process cache invalidation failed.',
    });
  }
  try {
    dependencies.revalidate(preview);
  } catch {
    operationalWarnings.push({
      code: 'path_revalidation_failed',
      message:
        'Pricing change committed; public path revalidation failed.',
    });
  }
  return {
    committed: true,
    preview,
    ...result,
    operationalWarnings,
  };
}
