import { buildCodexActionQueue } from '@/lib/seo/codex-action-queue';
import type {
  CodexSeoAction,
  ContentMomentumItem,
  CtrDoctorItem,
  InternalLinkSuggestion,
  MissingContentItem,
  SeoFamilyTrackerItem,
  StrategicSeoOpportunity,
} from '@/lib/seo/internal-seo-types';
import { buildContentMomentumItems } from '@/lib/seo/content-momentum';
import { buildCtrDoctorItems } from '@/lib/seo/ctr-doctor';
import { buildInternalLinkSuggestions } from '@/lib/seo/internal-link-builder';
import { buildMissingContentItems } from '@/lib/seo/missing-content';
import { buildModelFamilyTracker } from '@/lib/seo/model-family-tracker';
import { buildStrategicSeoOpportunities } from '@/lib/seo/seo-opportunity-engine';
import { fetchGscDashboardData, type GscDashboardData } from '@/server/seo/gsc';

export type SeoCockpitData = {
  gsc: GscDashboardData;
  opportunities: StrategicSeoOpportunity[];
  actions: CodexSeoAction[];
  ctrDoctorItems: CtrDoctorItem[];
  missingContentItems: MissingContentItem[];
  internalLinkSuggestions: InternalLinkSuggestion[];
  momentumItems: ContentMomentumItem[];
  familyTracker: SeoFamilyTrackerItem[];
  urgentActions: CodexSeoAction[];
  overview: {
    totalOpportunities: number;
    highPriorityActions: number;
    strongestFamily: SeoFamilyTrackerItem | null;
    weakestCtrFamily: SeoFamilyTrackerItem | null;
  };
};

export async function fetchSeoCockpitData(options?: {
  range?: string | null;
  forceRefresh?: boolean;
}): Promise<SeoCockpitData> {
  const gsc = await fetchGscDashboardData(options);
  const opportunities = buildStrategicSeoOpportunities(gsc.rows);
  const actions = buildCodexActionQueue(opportunities);
  const ctrDoctorItems = buildCtrDoctorItems(gsc.rows);
  const missingContentItems = buildMissingContentItems(gsc.rows);
  const internalLinkSuggestions = buildInternalLinkSuggestions({
    rows: gsc.rows,
    opportunities,
    ctrDoctorItems,
    missingContentItems,
  });
  const momentumItems = buildContentMomentumItems({
    currentRows: gsc.rows,
    previousRows: gsc.previousRows ?? [],
  });
  const familyTracker = buildModelFamilyTracker(gsc.rows, opportunities, gsc.previousRows ?? []);
  const activeFamilies = familyTracker.filter((family) => family.impressions > 0);

  return {
    gsc,
    opportunities,
    actions,
    ctrDoctorItems,
    missingContentItems,
    internalLinkSuggestions,
    momentumItems,
    familyTracker,
    urgentActions: actions.filter((action) => action.priority === 'critical' || action.priority === 'high').slice(0, 10),
    overview: {
      totalOpportunities: opportunities.length,
      highPriorityActions: actions.filter((action) => action.priority === 'critical' || action.priority === 'high').length,
      strongestFamily: activeFamilies.slice().sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)[0] ?? null,
      weakestCtrFamily:
        activeFamilies
          .filter((family) => family.impressions >= 50)
          .slice()
          .sort((a, b) => a.ctr - b.ctr || b.impressions - a.impressions)[0] ?? null,
    },
  };
}
