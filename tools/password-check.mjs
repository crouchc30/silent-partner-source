/* What happens to her books around the password. The scenario that matters most.
 *
 *   node tools/password-check.mjs
 *
 * The site ships sealed with a shared word nobody here knows, so this builds a throwaway copy
 * of the site re-sealed with a known one, and then plays out what the store manager actually
 * does: open the link, type some work in, set a password of her own, close the page, come back,
 * and -- the dangerous one -- type the old shared word out of habit.
 *
 * That last step used to destroy her books: the shared word opened a fresh EMPTY set and the
 * unlock path saved it straight over hers, after which her own password opened nothing. The
 * site now refuses the shared word as soon as any books exist. This is here so it stays that way.
 */
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import os from "node:os";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SHARED = "testword";
const HERS = "wisteria lantern copper fence";

const sleep = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(res => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });

// a copy of the site whose shared word we know
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "sp-pw-"));
for (const f of ["index.html", "app.js", "merge.js", "sync.js", "styles.css", "blank-vault.js"]) fs.copyFileSync(path.join(ROOT, f), path.join(DIR, f));
fs.mkdirSync(path.join(DIR, "tools"), { recursive: true });
fs.copyFileSync(path.join(ROOT, "tools", "seal-blank.mjs"), path.join(DIR, "tools", "seal-blank.mjs"));
const sealed = spawnSync("node", ["tools/seal-blank.mjs"], { cwd: DIR, env: { ...process.env, SP_PASSWORD: SHARED }, encoding: "utf8" });
if (sealed.status !== 0) { console.error("could not seal a test copy:", sealed.stderr); process.exit(1); }

const PORT = await freePort(), CDP = await freePort();
const profile = path.join(os.tmpdir(), `sp-pwchrome-${process.pid}`);
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1", "--directory", DIR], { stdio: "ignore" });
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`,
  "--no-first-run", "--no-default-browser-check", "--disable-gpu", "about:blank"], { stdio: "ignore" });
const done = () => { try { server.kill(); } catch {} try { chrome.kill(); } catch {} try { fs.rmSync(DIR, { recursive: true, force: true }); } catch {} };
process.on("exit", done);

let t; for (let i = 0; i < 40; i++) { try { t = await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json(); if (t.some(x => x.type === "page")) break; } catch {} await sleep(250); }
const ws = new WebSocket(t.find(x => x.type === "page").webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener("open", r, { once: true }));
let id = 0; const w = new Map();
ws.addEventListener("message", e => { const m = JSON.parse(e.data); if (m.id && w.has(m.id)) { w.get(m.id)(m); w.delete(m.id); } });
const send = (m, p = {}) => new Promise(res => { const n = ++id; w.set(n, res); ws.send(JSON.stringify({ id: n, method: m, params: p })); });
await send("Page.enable"); await send("Runtime.enable");
const run = async e => { const r = await send("Runtime.evaluate", { expression: `(async()=>{${e}})()`, awaitPromise: true, returnByValue: true }); return r.result && r.result.result ? r.result.result.value : undefined; };
const reload = async () => { await send("Page.navigate", { url: `http://localhost:${PORT}/index.html` }); for (let i = 0; i < 80; i++) { await sleep(150); if (await run("return document.readyState==='complete' && !!window.SPSync;")) return; } };
async function unlock(pw) {
  await run(`document.getElementById('unlockPw').value=${JSON.stringify(pw)};
    document.getElementById('unlockForm').dispatchEvent(new Event('submit',{cancelable:true,bubbles:true})); return true;`);
  for (let i = 0; i < 50; i++) { await sleep(200); if (await run("return !document.body.classList.contains('locked');")) return true; }
  return false;
}
const books = () => run("return { rows: state.ledger.length, vendors: state.ledger.map(r=>r.vendor).join(','), shared: !!state.sharedPw };");

let pass = 0, fail = 0;
const ck = (n, c, d) => { if (c) { pass++; console.log(`  ok   ${n}`); } else { fail++; console.log(`  FAIL ${n}${d ? "\n       " + d : ""}`); } };

console.log("She opens the link and types some work in");
await reload(); await run("localStorage.clear(); return true;"); await reload();
ck("the shared word opens the books", await unlock(SHARED));
ck("they start empty", (await books()).rows === 0);
ck("the site flags that it is still on the shared password", (await books()).shared === true);
await run(`document.querySelector('[data-tab=expenses]').click();
  document.getElementById('exDate').value='2026-11-08';
  document.getElementById('exVendor').value='Nike';
  document.getElementById('exAmount').value='400';
  document.getElementById('exStatus').value='paid';
  document.getElementById('expenseForm').dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));
  await saving; return true;`);
await sleep(400);
ck("her entry is saved", (await books()).rows === 1);

console.log("\nShe sets a password of her own");
await run(`document.querySelector('[data-tab=settings]').click();
  document.getElementById('pwOld').value=${JSON.stringify(SHARED)};
  document.getElementById('pwNew').value=${JSON.stringify(HERS)};
  document.getElementById('pwNew2').value=${JSON.stringify(HERS)};
  document.getElementById('pwForm').dispatchEvent(new Event('submit',{cancelable:true,bubbles:true})); return true;`);
await sleep(1200);
ck("her entry survives the change", (await books()).rows === 1);
ck("the shared-password warning switches off", (await books()).shared === false);

console.log("\nShe closes the page and comes back");
await reload();
ck("her own password opens it", await unlock(HERS));
ck("her work is still there after a reload", (await books()).rows === 1);

console.log("\nShe types the OLD SHARED WORD out of habit");
await reload();
const opened = await unlock(SHARED);
ck("the shared word is REFUSED once she has books of her own", opened === false,
   opened ? "it opened something, which means her books were just replaced" : "");
if (!opened) {
  const msg = await run("return document.getElementById('unlockErr').textContent;");
  ck("and the message explains why, rather than just 'wrong password'",
     /password the link came with/i.test(msg), msg);
}

console.log("\nShe types her own password again");
await reload();
const back = await unlock(HERS);
ck("her password still opens her books", back === true);
ck("and every entry is still there", back && (await books()).rows === 1);

console.log("\nStarting a device over deliberately still works");
await reload();
await run("localStorage.removeItem('silentPartner.vault'); return true;");
await reload();
ck("with nothing on the device, the shared word opens blank books again", await unlock(SHARED));
ck("and they are empty", (await books()).rows === 0);

console.log(`\n${pass} passed, ${fail} failed`);
done();
process.exit(fail ? 1 : 0);
