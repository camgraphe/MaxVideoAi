export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { deleteStudioCanvasTemplate, upsertStudioCanvasTemplate } from '@/server/studio/repository';
import { payloadRecord, payloadString, resolveStudioRouteContext, studioJson } from '../../_lib/studio-route-utils';

type CanvasTemplateRouteProps = {
  params: Promise<{ templateId: string }>;
};

function readCanvasTemplatePayload(payload: unknown): Record<string, unknown> {
  const body = payloadRecord(payload);
  return payloadRecord(body.template ?? body);
}

export async function PUT(req: NextRequest, props: CanvasTemplateRouteProps) {
  return saveStudioCanvasTemplate(req, props);
}

export async function PATCH(req: NextRequest, props: CanvasTemplateRouteProps) {
  return saveStudioCanvasTemplate(req, props);
}

async function saveStudioCanvasTemplate(req: NextRequest, props: CanvasTemplateRouteProps) {
  const context = await resolveStudioRouteContext(req);
  if (context.response) return context.response;

  const { templateId } = await props.params;
  const payload = await req.json().catch(() => null);
  const template = readCanvasTemplatePayload(payload);

  try {
    const savedTemplate = await upsertStudioCanvasTemplate({
      userId: context.userId,
      id: templateId,
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

export async function DELETE(req: NextRequest, props: CanvasTemplateRouteProps) {
  const context = await resolveStudioRouteContext(req);
  if (context.response) return context.response;

  const { templateId } = await props.params;
  try {
    const deleted = await deleteStudioCanvasTemplate({ userId: context.userId, templateId });
    if (!deleted) return studioJson({ ok: false, error: 'STUDIO_CANVAS_TEMPLATE_NOT_FOUND' }, { status: 404 });
    return studioJson({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'STUDIO_CANVAS_TEMPLATE_DELETE_FAILED';
    return studioJson({ ok: false, error: message }, { status: 500 });
  }
}
