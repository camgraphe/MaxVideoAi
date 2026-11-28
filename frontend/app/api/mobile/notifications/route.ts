import type { NextRequest } from 'next/server';
import { mobileResponse, mobileUser } from '@/server/mobile/http';
import { changeNotification, pushAvailability } from '@/server/mobile/notifications';
import { readBoundedJsonBody } from '@/server/read-bounded-json-body';
export const dynamic = 'force-dynamic';
export function GET() {
  return mobileResponse(async () => pushAvailability());
}
export function POST(req: NextRequest) {
  return mobileResponse(async () =>
    changeNotification(await mobileUser(req), await readBoundedJsonBody(req, 1500)),
  );
}
