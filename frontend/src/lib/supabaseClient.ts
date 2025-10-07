import { createClient } from '@supabase/supabase-js';

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined)?.trim() || '';
const anon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';

export const supabase = createClient(url, anon);
