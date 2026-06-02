import { Button } from '@/components/ui/Button';
import {
  getSurfaceStatusLabel,
  getSurfaceStatusTone,
} from './playlist-helpers';
import type { ModelPlaylistHelperCard } from './playlist-types';
import { StatusPill } from './PlaylistStatusPill';

export function MissingModelCard({
  helper,
  onCreate,
  onSeed,
  pending,
}: {
  helper: ModelPlaylistHelperCard;
  onCreate: (modelSlug: string) => void;
  onSeed: (modelSlug: string) => void;
  pending: boolean;
}) {
  return (
    <div className="rounded-card border border-dashed border-hairline bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-sm font-semibold text-text-primary">{helper.label}</p>
          <p className="truncate text-xs text-text-muted">{helper.slug}</p>
        </div>
        <StatusPill tone={getSurfaceStatusTone(helper.status)}>{getSurfaceStatusLabel(helper.status)}</StatusPill>
      </div>
      <p className="mt-3 text-xs text-text-secondary">{helper.helperText}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <StatusPill tone="neutral">{helper.route}</StatusPill>
        {helper.familyRoute ? <StatusPill tone="neutral">{helper.familyRoute}</StatusPill> : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => onCreate(helper.modelSlug)} disabled={pending}>
          Create empty
        </Button>
        <Button type="button" size="sm" onClick={() => onSeed(helper.modelSlug)} disabled={pending}>
          Seed from auto
        </Button>
      </div>
    </div>
  );
}
