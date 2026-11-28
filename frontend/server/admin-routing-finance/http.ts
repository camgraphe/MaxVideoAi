import { NextRequest, NextResponse } from 'next/server';
import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import { readAttempts, readLedger, readPurchases } from './data';
import { attemptsCsv, ledgerCsv, purchaseCsv, summaryCsv } from './csv';
import { readFinanceSummary } from './summary';
import { routingPeriod } from './period';

const headers = { 'Cache-Control': 'private, no-store' };
const services = {
  authorize: requireAdmin,
  summary: readFinanceSummary,
  purchases: readPurchases,
  ledger: readLedger,
  attempts: readAttempts,
};

export async function exportRoutingFinance(req: NextRequest, deps = services) {
  try {
    await deps.authorize(req);
  } catch (error) {
    const response = adminErrorToResponse(error);
    response.headers.set('Cache-Control', headers['Cache-Control']);
    return response;
  }
  const params = req.nextUrl.searchParams;
  const period = routingPeriod(params);
  const file = params.get('file');
  if (
    !period ||
    params.getAll('file').length !== 1 ||
    (file !== 'purchases' && file !== 'receipts' && file !== 'attempts' && file !== 'summary')
  ) {
    return NextResponse.json({ error: 'invalid_report_filters' }, { status: 400, headers });
  }
  try {
    let body: string;
    if (file === 'summary') body = summaryCsv(await deps.summary(period));
    else if (file === 'attempts') body = attemptsCsv(await deps.attempts(period));
    else if (file === 'receipts') body = ledgerCsv(await deps.ledger(period));
    else body = purchaseCsv(await deps.purchases(period));
    const scope = period.includeAdmin ? 'including-internal' : 'customer';
    return new NextResponse(body, {
      headers: {
        ...headers,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="routing-${file}-${period.from}-${period.to}-${scope}-utc.csv"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'routing_export_unavailable' }, { status: 503, headers });
  }
}
