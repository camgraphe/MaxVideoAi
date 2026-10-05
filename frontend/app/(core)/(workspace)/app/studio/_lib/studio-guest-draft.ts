/** Only the visitor's editable brief travels through login; demo media remain public examples. */
export function serializeStudioGuestDraft(message: string): string {
  return JSON.stringify({message:message.slice(0,4000)});
}

export function parseStudioGuestDraft(raw: string | null): string | null {
  if(!raw)return null;
  try {
    const value=JSON.parse(raw);
    return typeof value?.message==='string'&&value.message.trim()&&value.message.length<=4000?value.message:null;
  } catch {return null;}
}

export function studioGuestContinuationToken(value: string | string[] | undefined): string | null {
  return typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)?value:null;
}
