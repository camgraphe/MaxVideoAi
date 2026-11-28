import { workspaceModelPicks } from '@/lib/workspace-model-picks';
import { visibleMobileMode } from '@/lib/mobile-generation-contract';
import { type NextRequest } from 'next/server';
import { readMobileModels } from '@/server/mobile/catalog';
import { MobileHttpError, mobileResponse } from '@/server/mobile/http';

export const dynamic = 'force-dynamic';
export function GET(request: NextRequest) {
  return mobileResponse(async () => {
    const surface = request.nextUrl.searchParams.get('surface');
    if (surface !== 'image' && surface !== 'video')
      throw new MobileHttpError('PARAMETER_INVALID', 400, 'Choose a video or image catalog.');
    const details = await readMobileModels({
      surface,
      mediaReferences: request.nextUrl.searchParams.get('mediaReferences') === '1',
      modelSettings: request.nextUrl.searchParams.get('modelSettings') === '1',
      videoOperations: request.nextUrl.searchParams.get('videoOperations') === '1',
    });
    const visible = details
      .map((model) => ({
        ...model,
        modes: model.modes.filter(
          (m) => visibleMobileMode(m.mode, request.nextUrl.searchParams),
        ),
      }))
      .filter((model) => model.modes.length);
    return {
      models: visible.map(({ id, label, provider, surface, supportsFramePair, modes }) => ({
        id, label, provider, surface, supportsFramePair, pickerRecommendations: workspaceModelPicks(id), modes: modes.map(control => control.mode),
      })),
    };
  });
}
