import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/server/admin';
import { listBillingProducts, updateBillingProduct } from '@/lib/billing-products';

export const runtime = 'nodejs';

function toInteger(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  if (typeof value === 'string' && value.trim().length) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.round(parsed);
  }
  return fallback;
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
  } catch (response) {
    if (response instanceof Response) return response;
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const products = await listBillingProducts();
    return NextResponse.json({ ok: true, products });
  } catch (error) {
    console.error('[api/admin/billing-products] failed to list products', error);
    return NextResponse.json({ ok: false, error: 'Failed to load tool pricing' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireAdmin(req);
  } catch (response) {
    if (response instanceof Response) return response;
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
  }

  const productKey = typeof payload.productKey === 'string' ? payload.productKey.trim() : '';
  if (!productKey) {
    return NextResponse.json({ ok: false, error: 'Missing product key' }, { status: 400 });
  }

  try {
    const product = await updateBillingProduct({
      productKey,
      label: typeof payload.label === 'string' ? payload.label : null,
      currency: typeof payload.currency === 'string' ? payload.currency : null,
      unitPriceCents:
        payload.unitPriceCents == null ? null : Math.max(0, toInteger(payload.unitPriceCents)),
      active: typeof payload.active === 'boolean' ? payload.active : null,
    });
    return NextResponse.json({ ok: true, product });
  } catch (error) {
    console.error('[api/admin/billing-products] failed to update product', error);
    const message = error instanceof Error ? error.message : 'Failed to update tool pricing';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
