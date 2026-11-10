/* Accounts: the shared link word, then a real account per person.
 *
 * Two different things guard this site and it is worth keeping them apart.
 *
 * The link word (config.linkWord) is a doorbell. It keeps the sign-up page from being the
 * first thing a stranger who stumbles on the URL sees. It is checked in the browser, it is
 * in this file, and anyone who reads the page source can find it. It protects nothing and
 * is not meant to.
 *
 * The account is the lock. Email and password, checked by Supabase, and the books cannot be
 * read without one -- that rule lives in the database (row-level security), not here, so
 * editing this file in a browser gets a person nothing.
 */
(function () {
  const cfg = window.SP_CONFIG || {};
  const GATE_KEY = "sp.gate.v1";

  let client = null;
  function db() {
    if (!client) {
      if (!window.supabase) throw new Error("supabase library did not load");
      client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnon, {
        auth: { persistSession: true, autoRefreshToken: true },
      });
    }
    return client;
  }

  // ---- the doorbell -------------------------------------------------------
  // A site can switch the doorbell off entirely by leaving linkWord empty, which is what a
  // site being advertised to strangers wants: making people guess a word before they are even
  // allowed to see a sign-up form costs real users and stops nobody.
  function gateNeeded() { return !!String(cfg.linkWord || "").trim(); }
  function gatePassed() { return !gateNeeded() || localStorage.getItem(GATE_KEY) === "1"; }
  function tryGate(word) {
    const ok = String(word || "").trim().toLowerCase() === String(cfg.linkWord).toLowerCase();
    if (ok) localStorage.setItem(GATE_KEY, "1");
    return ok;
  }

  // ---- accounts -----------------------------------------------------------
  async function signUp(email, password) {
    const { data, error } = await db().auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: location.origin + location.pathname },
    });
    if (error) throw error;
    // Supabase returns a user with no session when confirmation email is on.
    return { user: data.user, needsConfirm: !data.session };
  }

  async function signIn(email, password) {
    const { data, error } = await db().auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    return data.user;
  }

  async function signOut() {
    try { await db().auth.signOut(); } finally { location.reload(); }
  }

  // The forgot-password mail. Supabase sends it; the link lands on reset.html.
  async function sendReset(email) {
    const base = location.origin + location.pathname.replace(/[^/]*$/, "");
    const { error } = await db().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: base + "reset.html",
    });
    if (error) throw error;
  }

  // Used by reset.html once the emailed link has signed the person in.
  async function setPassword(password) {
    const { error } = await db().auth.updateUser({ password });
    if (error) throw error;
  }

  async function currentUser() {
    const { data } = await db().auth.getSession();
    return data.session ? data.session.user : null;
  }

  function onAuthChange(fn) { db().auth.onAuthStateChange((_e, s) => fn(s ? s.user : null)); }

  // Friendlier wording than Supabase's own, which talks about "credentials".
  function explain(err) {
    const m = String((err && err.message) || err || "").toLowerCase();
    if (m.includes("invalid login")) return "That email and password don't match an account. Check both, or use “Forgot your password?” below.";
    if (m.includes("already registered")) return "There is already an account with that email. Sign in instead, or reset the password.";
    if (m.includes("password should be")) return "Passwords need to be at least 8 characters. A short phrase works well.";
    if (m.includes("email not confirmed")) return "Check your email and click the link we sent, then sign in.";
    if (m.includes("rate limit") || m.includes("too many")) return "Too many tries just now. Wait a minute and try again.";
    if (m.includes("failed to fetch") || m.includes("network")) return "Couldn't reach the server. Check the internet connection and try again.";
    return "Something went wrong: " + ((err && err.message) || "unknown error");
  }

  window.SPAuth = {
    db, gateNeeded, gatePassed, tryGate, signUp, signIn, signOut,
    sendReset, setPassword, currentUser, onAuthChange, explain,
  };
})();
