/* Which Supabase project this copy of the site talks to, and what it calls itself.
 *
 * The anon key below is meant to be public -- it is in every visitor's browser either way.
 * What stops one business reading another's books is the row-level security in
 * supabase/schema.sql, not secrecy about this string. The service-role key is the one that
 * must never appear here; it is not used by the site at all.
 */
window.SP_CONFIG = {
  supabaseUrl:  "PASTE_PROJECT_URL_HERE",      // https://xxxxxxxx.supabase.co
  supabaseAnon: "PASTE_ANON_PUBLIC_KEY_HERE",  // the "anon public" key, not "service_role"

  // The word that opens the front door for anyone with the link, before they
  // have an account. A doorbell, not a lock -- see docs/SETUP.md.
  linkWord: "grassmere",

  shopName: "My Business",
};
