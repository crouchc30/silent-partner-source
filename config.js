/* Which Supabase project this copy of the site talks to, and what it calls itself.
 *
 * The anon key below is meant to be public -- it is in every visitor's browser either way.
 * What stops one business reading another's books is the row-level security in
 * supabase/schema.sql, not secrecy about this string. The service-role key is the one that
 * must never appear here; it is not used by the site at all.
 */
window.SP_CONFIG = {
  supabaseUrl:  "https://lanqmvwdmqlgnyarnohz.supabase.co",
  supabaseAnon: "sb_publishable_0G8AoOfhw-de8KmVgfcWsQ_XUFhGSbG",

  // The word that opens the front door for anyone with the link, before they
  // have an account. A doorbell, not a lock -- see docs/SETUP.md.
  linkWord: "grassmere",

  shopName: "The Scot Shop",
};
