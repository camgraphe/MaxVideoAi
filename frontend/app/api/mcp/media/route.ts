import {deliverMcpMediaLink} from '@/server/mcp/media-link-delivery';

export const runtime = 'nodejs';
export function GET(request:Request) {return deliverMcpMediaLink(request);}
export function HEAD(request:Request) {return deliverMcpMediaLink(request);}
