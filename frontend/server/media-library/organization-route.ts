import { NextResponse } from 'next/server';
import { LibraryOrganizationError } from './organization-validation';
export function organizationResponse(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } }); }
export function organizationRouteError(error: unknown) {
    return organizationResponse({ ok: false, error: error instanceof LibraryOrganizationError ? error.message : error instanceof SyntaxError ? 'INVALID_JSON' : 'ORGANIZATION_FAILED' }, error instanceof LibraryOrganizationError ? error.status : error instanceof SyntaxError ? 400 : 500);
}
