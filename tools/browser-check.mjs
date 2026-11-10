/* Drives the real page in a real Chrome and checks it behaves.
 *
 *   node tools/browser-check.mjs
 *
 * It serves the project on a spare port, opens it in headless Chrome, and works the actual
 * forms: unlocking, typing an expense, reloading, deleting, and trying to switch on saving to
 * GitHub. Nothing is sent to github.com; the one call it makes there uses a deliberately invalid
 * token to check the error is handled.
 *
 * Exits 0 if every case passes, 1 if any fails.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import net from "node:net";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const freePort = () => new Promise(res => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });
const PORT = await freePort();
const CDP_PORT = await freePort();
const BASE = `http://localhost:${PORT}`;
const profile = path.join("/tmp", `sp-chrome-${process.pid}`);

const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1", "--directory", ROOT], { stdio: "ignore" });
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
  "--no-first-run", "--no-default-browser-check", "--disable-gpu", "about:blank"], { stdio: "ignore" });
const shutdown = () => { try { server.kill(); } catch {} try { chrome.kill(); } catch {} };
process.on("exit", shutdown);
process.on("SIGINT", () => { shutdown(); process.exit(130); });

let pass = 0, fail = 0;
const check = (n, c, d) => { if (c) { pass++; console.log(`  ok   ${n}`); } else { fail++; console.log(`  FAIL ${n}${d ? "\n       " + d : ""}`); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// --- the smallest usable Chrome DevTools Protocol client ---
async function connect() {
  let targets;
  for (let i = 0; i < 40; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json(); if (targets.some(t => t.type === "page")) break; } catch {}
    await sleep(250);
  }
  const page = targets.find(t => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener("open", r, { once: true }));
  let id = 0; const waiting = new Map(); const events = [];
  ws.addEventListener("message", e => {
    const m = JSON.parse(e.data);
    if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
    else if (m.method) events.push(m);
  });
  const send = (method, params = {}) => new Promise(res => { const n = ++id; waiting.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });
  return { send, events };
}

const cdp = await connect();
await cdp.send("Page.enable");
await cdp.send("Runtime.enable");
await cdp.send("Log.enable");

async function evaluate(expr) {
  const r = await cdp.send("Runtime.evaluate", { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true });
  if (r.result && r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
  if (r.result && r.result.result && r.result.result.subtype === "error") throw new Error(r.result.result.description);
  return r.result && r.result.result ? r.result.result.value : undefined;
}
async function goto(url) {
  await cdp.send("Page.navigate", { url });
  for (let i = 0; i < 60; i++) { await sleep(150); const ok = await evaluate("return document.readyState === 'complete' && !!window.SPSync;").catch(() => false); if (ok) return; }
  throw new Error("page never finished loading");
}
const IGNORE = /favicon|api\.github\.com|401 \(|Failed to load resource: the server responded with a status of 401/i;
const errors = () => cdp.events
  .filter(e => e.method === "Log.entryAdded" && e.params.entry.level === "error")
  // the url matters as much as the text: a 404's message doesn't say what failed to load
  .map(e => `${e.params.entry.text} [${e.params.entry.url || ""}]`)
  .concat(cdp.events.filter(e => e.method === "Runtime.exceptionThrown")
    .map(e => e.params.exceptionDetails.text + " " + (e.params.exceptionDetails.exception || {}).description))
  .filter(t => !IGNORE.test(t));

console.log("1. The page loads clean");
await goto(BASE + "/index.html");
check("no JavaScript errors on load", errors().length === 0, errors().join("\n       "));
check("merge.js and sync.js are both live", await evaluate("return typeof SPMerge === 'object' && typeof SPSync === 'object';"));
check("the lock screen is up", await evaluate("return document.body.classList.contains('locked') && !document.getElementById('unlockForm').classList.contains('hidden');"));
check("saving to GitHub is OFF until it's set up", await evaluate("return SPSync.isOn() === false && SPSync.status().state === 'off';"));
check("the Saved badge is hidden while it's off", await evaluate("return document.getElementById('syncBadge').classList.contains('hidden');"));
check("nothing in the page mentions a demo any more", await evaluate("return !/Load Scot Shop demo|invented sample data/i.test(document.body.innerHTML);"));

// Seal a set of books with a password we know, so we can get past the lock screen.
const PW = "a long passphrase for testing";
const makeVault = (stateExpr) => `
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(${JSON.stringify(PW)}, salt);
  const v = await sealVault(key, salt, ${stateExpr});
  v.savedAt = new Date().toISOString();
  localStorage.setItem('silentPartner.vault', JSON.stringify(v));
  return true;`;
async function unlock() {
  await evaluate(`document.getElementById('unlockPw').value = ${JSON.stringify(PW)};
    document.getElementById('unlockForm').dispatchEvent(new Event('submit', {cancelable:true, bubbles:true}));
    return true;`);
  for (let i = 0; i < 60; i++) { await sleep(200); if (await evaluate("return !document.body.classList.contains('locked');")) return true; }
  return false;
}

console.log("\n2. Empty books open and take real entries");
await evaluate("localStorage.clear(); return true;");
await goto(BASE + "/index.html");
await evaluate(makeVault("freshState()"));
await goto(BASE + "/index.html");
check("the password opens the books", await unlock());
check("they start completely empty", await evaluate("return state.ledger.length===0 && state.cash.length===0 && state.sales.length===0 && state.recurring.length===0;"));
check("the safe-to-spend figure starts at $0", await evaluate("return document.getElementById('heroSafe').textContent.trim() === '$0';"));

// add a real expense through the actual form
await evaluate(`
  document.querySelector('[data-tab=expenses]').click();
  document.getElementById('exDate').value = '2026-11-03';
  document.getElementById('exVendor').value = 'Nike';
  document.getElementById('exDesc').value = 'fall order';
  document.getElementById('exAmount').value = '400';
  document.getElementById('exStatus').value = 'paid';
  document.getElementById('expenseForm').dispatchEvent(new Event('submit', {cancelable:true, bubbles:true}));
  return true;`);
await sleep(400);
check("an expense typed into the form is kept", await evaluate("return state.ledger.length===1 && state.ledger[0].vendor==='Nike';"));
check("it got a uid and a timestamp, so it can be merged later", await evaluate("return !!state.ledger[0].uid && !!state.ledger[0].touched;"));
check("it reached the encrypted store in this browser", await evaluate("await saving; const v=JSON.parse(localStorage.getItem('silentPartner.vault')); return !!v.ct && !!v.savedAt && !/Nike/.test(localStorage.getItem('silentPartner.vault'));"));

console.log("\n3. It is still there after closing and reopening the page");
await goto(BASE + "/index.html");
check("the books survive a reload", await unlock() && await evaluate("return state.ledger.length===1 && state.ledger[0].vendor==='Nike';"));

console.log("\n4. Deleting leaves a marker, so it stays deleted everywhere");
await evaluate(`const id = state.ledger[0].id;
  window.confirm = () => true;
  document.querySelector('[data-del="'+id+'"]').click();
  return true;`);
await sleep(300);
check("the row is gone", await evaluate("return state.ledger.length === 0;"));
check("and a tombstone was recorded", await evaluate("return Object.keys(state.deleted||{}).length === 1;"));

console.log("\n5. Old books that still hold the demo get emptied on open");
await evaluate("localStorage.clear(); return true;");
await goto(BASE + "/index.html");
await evaluate(makeVault(`(() => { const s = freshState(); s.demo = true;
  s.ledger = [{id:1, date:'2026-10-01', vendor:'INVENTED SUPPLIER', desc:'sample', amount:999, status:'paid', ok:true}];
  s.cash = [{date:'2026-10-01', balance:12345}];
  s.sales = [{week:'2026-10-01', net:5555}];
  s.nextId = 2; return s; })()`));
await goto(BASE + "/index.html");
await unlock();
check("the invented rows are cleared out", await evaluate("return state.ledger.length===0 && state.cash.length===0 && state.sales.length===0;"));
check("the demo flag is gone for good", await evaluate("return !state.demo;"));
check("and it survives the next reload", (await goto(BASE + "/index.html"), await unlock()) && await evaluate("return state.ledger.length===0 && !state.demo;"));

console.log("\n6. The sync card, and the refusal to sync shared-password books");
await evaluate("document.querySelector('[data-tab=settings]').click(); return true;");
check("the Settings page has the GitHub card", await evaluate("return !!document.getElementById('syncForm') && /save to GitHub/i.test(document.getElementById('tab-settings').textContent);"));
check("the warning is hidden for books with their own password", await evaluate("return document.getElementById('syncShared').classList.contains('hidden');"));
await evaluate(`state.sharedPw = true; renderAll();
  document.getElementById('syncOwner').value='crouchc30';
  document.getElementById('syncRepo').value='silent-partner-books';
  document.getElementById('syncToken').value='github_pat_fake';
  document.getElementById('syncForm').dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));
  return true;`);
await sleep(600);
check("books on the shared password are REFUSED", await evaluate("return SPSync.isOn() === false;"));
check("and the page says why, in plain words", await evaluate("return /password of your own/i.test(document.getElementById('syncErr').textContent);"),
  await evaluate("return document.getElementById('syncErr').textContent;"));
check("the shared-password warning is showing", await evaluate("return !document.getElementById('syncShared').classList.contains('hidden');"));

console.log("\n7. A bad token is reported, and nothing is lost");
await evaluate(`state.sharedPw = false; renderAll();
  document.getElementById('syncToken').value='github_pat_definitely_not_valid';
  document.getElementById('syncForm').dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));
  return true;`);
await sleep(3000);
check("a bad token does not switch sync on", await evaluate("return SPSync.isOn() === false;"));
check("the error names the problem", await evaluate("return document.getElementById('syncErr').textContent.length > 10;"),
  await evaluate("return document.getElementById('syncErr').textContent;"));
check("the books are untouched", await evaluate("return !!state && typeof state.ledger.length === 'number';"));

const late = errors();
check("no unexpected JavaScript errors across the whole run", late.length === 0, late.join("\n       "));

console.log(`\n${pass} passed, ${fail} failed`);
shutdown();
process.exit(fail ? 1 : 0);
