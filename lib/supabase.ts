import { createClient } from '@supabase/supabase-js'

// Publishable key is safe to expose in the browser. Row Level Security
// policies on the `tasks` table control what it can read and write.
const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  'https://snvngbxjawhuturkrvwf.supabase.co'
const key =
  process.env.NEXT_PUBLIC_SUPABASE_KEY ??
  'sb_publishable_ol5gg_WTONSD3GPZrU4Ocw_eazTqdpg'

export const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})
