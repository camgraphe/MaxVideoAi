export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { listStudioCanvasTemplates, upsertStudioCanvasTemplate } from '@/server/studio/repository';
import { payloadRecord, payloadString, resolveStudioRouteContext, studioJson } from '../_lib/studio-route-utils';

function readCanvasTemplatePayload(payload: unknown): Record<string, unknown> {
  const body = payloadRecord(payload);
  return payloadRecord(body.template ?? body);
}

export async function GET(req: NextRequest) {
  const context = await resolveStudioRouteContext(req);
  if (context.response) return context.response;

  try {
    const templates = await listStudioCanvasTemplates({ userId: context.userId });
    return studioJson({ ok: true, templates });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'STUDIO_CANVAS_TEMPLATES_LIST_FAILED';
    return studioJson({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const context = await resolveStudioRouteContext(req);
  if (context.response) return context.response;

  const payload = await req.json().catch(() => null);
  const template = readCanvasTemplatePayload(payload);

  try {
    const savedTemplate = await upsertStudioCanvasTemplate({
      userId: context.userId,
      id: payloadString(template.id),
      name: payloadString(template.name) ?? 'Untitled canvas template',
      description: payloadString(template.description),
      nodes: template.nodes,
      edges: template.edges,
    });
    return studioJson({ ok: true, template: savedTemplate });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'STUDIO_CANVAS_TEMPLATE_SAVE_FAILED';
    const status = message === 'STUDIO_CANVAS_TEMPLATE_CONFLICT' ? 409 : 400;
    return studioJson({ ok: false, error: message }, { status });
  }
}
