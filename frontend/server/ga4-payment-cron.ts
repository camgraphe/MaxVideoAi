import { timingSafeEqual } from 'node:crypto';

type CronEnv = { VERCEL_ENV?: string; CRON_SECRET?: string; GA4_PAYMENTS_DISABLED?: string };
export function createGa4PaymentCronHandler(env: CronEnv, run: () => Promise<Record<string, unknown>>) {
  return async (request: Request): Promise<Response> => {
    const secret = env.CRON_SECRET?.trim();
    if (env.VERCEL_ENV !== 'production' || !secret || env.GA4_PAYMENTS_DISABLED === '1') {
      return Response.json({ok:false,error:'unavailable'},{status:503});
    }
    const expected = Buffer.from(`Bearer ${secret}`);
    const supplied = Buffer.from(request.headers.get('authorization') ?? '');
    if (supplied.length !== expected.length || !timingSafeEqual(supplied,expected)) {
      return Response.json({ok:false,error:'unauthorized'},{status:401});
    }
    try { return Response.json({ok:true,...await run()}); }
    catch {
      console.warn('[ga4-payments] drain unavailable');
      return Response.json({ok:false,error:'delivery_unavailable'},{status:503});
    }
  };
}
