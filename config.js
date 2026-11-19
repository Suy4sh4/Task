/* ------------------------------------------------------------------
   Cross-device sync via Supabase.

   Only the PUBLISHABLE key belongs here. Never put a secret key in
   browser code — it bypasses Row Level Security.
------------------------------------------------------------------- */

window.TASKS_CONFIG = {
  supabaseUrl: "https://snvngbxjawhuturkrvwf.supabase.co",

  // Publishable key (safe for the browser when RLS is enabled).
  supabaseAnonKey: "sb_publishable_ol5gg_WTONSD3GPZrU4Ocw_eazTqdpg",

  // How often other devices are checked for changes (milliseconds).
  pollMs: 4000,
};
