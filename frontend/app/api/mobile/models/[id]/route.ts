import { visibleMobileMode } from '@/lib/mobile-generation-contract';
import { type NextRequest } from 'next/server';
import { readMobileModels } from '@/server/mobile/catalog';
import { MobileHttpError, mobileResponse } from '@/server/mobile/http';

export const dynamic = 'force-dynamic';
export function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return mobileResponse(async () => {
    const { id } = await context.params;
    const [model] = await readMobileModels({
      id,
      mediaReferences: request.nextUrl.searchParams.get('mediaReferences') === '1',
      modelSettings: request.nextUrl.searchParams.get('modelSettings') === '1',
      videoOperations: request.nextUrl.searchParams.get('videoOperations') === '1',
    });
    if (!model) throw new MobileHttpError('MODEL_NOT_FOUND', 404, 'This model is unavailable.');
    const modes = model.modes.filter(
      (m) => visibleMobileMode(m.mode, request.nextUrl.searchParams),
    );
    if (!modes.length) throw new MobileHttpError('MODEL_NOT_FOUND', 404, 'This model is unavailable.');
    return { ...model, modes };
  });
}
