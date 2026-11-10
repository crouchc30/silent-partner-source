/* Two people, one set of books, against the real database.
 *
 *   node tools/live-check.mjs
 *
 * Everything the single-browser tests cannot reach: that signing in joins you to the same
 * books as everybody else, that two people saving at once keeps both their work, and that
 * History ends up with the right name against the right action.
 */
const CFG = await import("node:fs").then(fs =>
  fs.readFileSync(new URL("../config.js", import.meta.url), "utf8"));
const URL_ = /supabaseUrl:\s*"([^"]+)"/.exec(CFG)[1];
const KEY  = /supabaseAnon:\s*"([^"]+)"/.exec(CFG)[1];

let pass = 0, fail = 0;
const ok  = m => { console.log("  ok   " + m); pass++; };
const bad = m => { console.log("  FAIL " + m); fail++; };

const api = async (path, { token, method = "GET", body, prefer } = {}) => {
  const h = { apikey: KEY, "Content-Type": "application/json" };
  if (token) h.Authorization = "Bearer " + token;
  if (prefer) h.Prefer = prefer;
  const r = await fetch(URL_ + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  let j = null; try { j = t ? JSON.parse(t) : null; } catch { j = t; }
  return { status: r.status, body: j };
};

const signIn = async (email, password) => {
  const r = await api("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password } });
  if (!r.body?.access_token) throw new Error("could not sign in as " + email + ": " + JSON.stringify(r.body));
  return r.body.access_token;
};

console.log("\nSigning in");
const mollie = await signIn("mollie-test@scotshop.test", "test-passphrase-one");
ok("Mollie can sign in");
const shelly = await signIn("shelly-test@scotshop.test", "test-passphrase-two");
ok("Shelly can sign in");

console.log("\nOne set of books for both of them");
const m1 = await api("/rest/v1/rpc/join_shop", { token: mollie, method: "POST", body: { shop_name: "The Scot Shop" } });
const s1 = await api("/rest/v1/rpc/join_shop", { token: shelly, method: "POST", body: { shop_name: "The Scot Shop" } });
const bid = m1.body;
typeof bid === "string" && bid.length > 10 ? ok("Mollie joined and got a business") : bad("join failed: " + JSON.stringify(m1));
s1.body === bid ? ok("Shelly landed in the SAME books, not her own") : bad("Shelly got a different business: " + JSON.stringify(s1.body));

console.log("\nSaving");
const v0 = (await api(`/rest/v1/books?business_id=eq.${bid}&select=version`, { token: mollie })).body[0].version;
const bookA = { settings: { name: "The Scot Shop", reserve: 1500, horizon: 90, caution: 75, big: 1000, categories: ["Inventory"] },
                ledger: [{ id: 1, vendor: "Nike", amount: 1240, date: "2026-11-10", status: "unpaid" }], nextId: 2, cash: [], sales: [], recurring: [], mgmt: [], deleted: {} };
const sA = await api("/rest/v1/rpc/save_books", { token: mollie, method: "POST", body: { bid, new_doc: bookA, expected_version: v0 } });
Number(sA.body) === Number(v0) + 1 ? ok("Mollie's save went through") : bad("save failed: " + JSON.stringify(sA));

const readBack = (await api(`/rest/v1/books?business_id=eq.${bid}&select=doc`, { token: shelly })).body[0].doc;
readBack.ledger[0].vendor === "Nike" ? ok("Shelly can read what Mollie just saved") : bad("Shelly cannot see Mollie's entry");

console.log("\nBoth saving at once, on purpose");
// Shelly is still holding the version from BEFORE Mollie's save. This is the collision.
const bookB = JSON.parse(JSON.stringify(bookA));
bookB.ledger = [{ id: 9, vendor: "Under Armour", amount: 880, date: "2026-11-10", status: "unpaid" }];
const stale = await api("/rest/v1/rpc/save_books", { token: shelly, method: "POST", body: { bid, new_doc: bookB, expected_version: v0 } });
String(stale.body?.message || "").includes("changed on another device")
  ? ok("the stale save was REFUSED instead of wiping Mollie's row") : bad("stale save was accepted: " + JSON.stringify(stale.body));

// What the browser does next: re-read, merge both sets of rows, save again.
const cur = (await api(`/rest/v1/books?business_id=eq.${bid}&select=doc,version`, { token: shelly })).body[0];
const merged = JSON.parse(JSON.stringify(cur.doc));
merged.ledger = [...cur.doc.ledger, ...bookB.ledger];
const retry = await api("/rest/v1/rpc/save_books", { token: shelly, method: "POST", body: { bid, new_doc: merged, expected_version: cur.version } });
Number(retry.body) === Number(cur.version) + 1 ? ok("after merging, Shelly's retry went through") : bad("retry failed: " + JSON.stringify(retry.body));

const final = (await api(`/rest/v1/books?business_id=eq.${bid}&select=doc`, { token: mollie })).body[0].doc;
const vendors = final.ledger.map(r => r.vendor).sort();
JSON.stringify(vendors) === '["Nike","Under Armour"]'
  ? ok("BOTH entries survived — nobody's work was lost") : bad("ledger ended up as " + JSON.stringify(vendors));

console.log("\nHistory");
await api("/rest/v1/history", { token: mollie, method: "POST", body: { business_id: bid, user_id: (JSON.parse(Buffer.from(mollie.split(".")[1], "base64url").toString())).sub, email: "mollie-test@scotshop.test", action: "added an expense", detail: "Nike $1,240.00" } });
await api("/rest/v1/history", { token: shelly, method: "POST", body: { business_id: bid, user_id: (JSON.parse(Buffer.from(shelly.split(".")[1], "base64url").toString())).sub, email: "shelly-test@scotshop.test", action: "added an expense", detail: "Under Armour $880.00" } });
const hist = (await api(`/rest/v1/history?business_id=eq.${bid}&select=email,action,detail&order=at.desc`, { token: mollie })).body;
hist.length >= 2 ? ok("History recorded both of them") : bad("history has " + hist.length + " rows");
hist.some(h => h.email.startsWith("mollie") && h.detail.includes("Nike")) ? ok("Mollie's action is against Mollie's name") : bad("Mollie's row is wrong");
hist.some(h => h.email.startsWith("shelly") && h.detail.includes("Under Armour")) ? ok("Shelly's action is against Shelly's name") : bad("Shelly's row is wrong");
(await api(`/rest/v1/history?business_id=eq.${bid}`, { token: shelly })).body.length === hist.length
  ? ok("and Shelly sees the same History Mollie does") : bad("the two see different histories");

console.log("\nHistory cannot be rewritten");
const tamper = await api(`/rest/v1/history?business_id=eq.${bid}`, { token: mollie, method: "PATCH", body: { action: "nothing to see here" } });
const del = await api(`/rest/v1/history?business_id=eq.${bid}`, { token: mollie, method: "DELETE" });
const still = (await api(`/rest/v1/history?business_id=eq.${bid}&select=action`, { token: mollie })).body;
still.length === hist.length && !still.some(h => h.action.includes("nothing to see"))
  ? ok("edits and deletes both bounce off") : bad("History was changed: " + JSON.stringify([tamper.status, del.status, still.length]));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
