import {GUEST_CREATION_MAX_BYTES} from '@/lib/guest-creation-continuation';

/** Only the visitor's editable brief travels through login; demo media remain public examples. */
export function serializeStudioGuestDraft(message: string): string | null {
  if(message.length>GUEST_CREATION_MAX_BYTES)return null;
  const payload=JSON.stringify({message});
  return payload.length<=GUEST_CREATION_MAX_BYTES?payload:null;
}

export function parseStudioGuestDraft(raw: string | null): string | null {
  if(!raw||raw.length>GUEST_CREATION_MAX_BYTES)return null;
  try {
    const value=JSON.parse(raw);
    return typeof value?.message==='string'&&value.message.trim()?value.message:null;
  } catch {return null;}
}

export function studioGuestContinuationToken(value: string | string[] | undefined): string | null {
  return typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)?value:null;
}
