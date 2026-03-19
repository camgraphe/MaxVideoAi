import { NextRequest, NextResponse } from 'next/server';
import { getBillingProduct, listBillingProducts } from '@/lib/billing-products';
import { normalizeJobSurface } from '@/lib/job-surface';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const productKey = (req.nextUrl.searchParams.get('productKey') ?? '').trim() || null;
    const requestedSurface = normalizeJobSurface(req.nextUrl.searchParams.get('surface'));

    if (productKey) {
      const product = await getBillingProduct(productKey);
      if (!product || !product.active) {
        return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });
      }
      return NextResponse.json({ ok: true, product });
    }

    const products = (await listBillingProducts()).filter((product) => product.active);
    const filtered =
      requestedSurface && requestedSurface !== 'video'
        ? products.filter((product) => product.surface === requestedSurface)
        : requestedSurface === 'video'
          ? products.filter((product) => product.surface === 'video')
          : products;

    return NextResponse.json({ ok: true, products: filtered });
  } catch (error) {
    console.error('[api/billing-products] failed', error);
    return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
