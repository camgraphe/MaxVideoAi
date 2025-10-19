import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/server/admin';
import { deletePricingRule } from '@/lib/pricing';

export const runtime = 'nodejs';

export async function DELETE(req: NextRequest, { params }: { params: { ruleId: string } }) {
  try {
    await requireAdmin(req);
  } catch (response) {
    if (response instanceof Response) return response;
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const ruleId = params.ruleId;
  if (!ruleId) {
    return NextResponse.json({ error: 'Missing pricing rule id' }, { status: 400 });
  }

  try {
    await deletePricingRule(ruleId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes('database not configured')) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 501 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
