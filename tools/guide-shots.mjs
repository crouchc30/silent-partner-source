/* Build the pictures used by guide.html.
 *
 *   node tools/guide-shots.mjs
 *
 * Opens the real site in headless Chrome, fills it with clearly-labelled example figures, and
 * photographs each part of each page into guide/img/. Re-run it whenever the look of the site
 * changes, so the instructions never show something that isn't there any more.
 *
 * The example figures live only in this script and only ever reach a throwaway browser profile.
 * Nothing invented is written into the site itself.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";

// Which copy of the site to photograph. The two built sites use different words for the
// same pages -- one says "Sports Club check", the other "Year-end payout" -- so each needs
// pictures of itself. Without this the general site's walkthrough shows the Scot Shop.
const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = process.argv[2] ? path.resolve(process.argv[2]) : HERE;
const GENERAL = /general/.test(ROOT);
const OUT = path.join(ROOT, "guide", "img");
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PW = "example books passphrase";

fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(res => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });

const PORT = await freePort(), CDP_PORT = await freePort();
const profile = path.join("/tmp", `sp-shots-${process.pid}`);
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1", "--directory", ROOT], { stdio: "ignore" });
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
  "--no-first-run", "--no-default-browser-check", "--disable-gpu", "--force-color-profile=srgb", "about:blank"], { stdio: "ignore" });
const shutdown = () => { try { server.kill(); } catch {} try { chrome.kill(); } catch {} };
process.on("exit", shutdown);

async function connect() {
  let targets;
  for (let i = 0; i < 40; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json(); if (targets.some(t => t.type === "page")) break; } catch {}
    await sleep(250);
  }
  const page = targets.find(t => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener("open", r, { once: true }));
  let id = 0; const waiting = new Map();
  ws.addEventListener("message", e => { const m = JSON.parse(e.data); if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); } });
  return (method, params = {}) => new Promise(res => { const n = ++id; waiting.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });
}
const send = await connect();
await send("Page.enable"); await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1180, height: 920, deviceScaleFactor: 2, mobile: false });

const run = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true });
  if (r.result && r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails.exception || r.result.exceptionDetails));
  return r.result && r.result.result ? r.result.result.value : undefined;
};
const goto = async () => {
  await send("Page.navigate", { url: `http://localhost:${PORT}/index.html` });
  for (let i = 0; i < 80; i++) { await sleep(150); if (await run("return document.readyState==='complete' && !!window.SPAuth && !!window.SPCloud;").catch(() => false)) return; }
  throw new Error("page did not load");
};

/* ---------- example books: illustrative only, never shipped in the site ---------- */
const BOOKS = {
  settings: GENERAL ? {
    name: "Baker Street Books", type: "Retail shop",
    goal: "paying ourselves properly at the end of the year",
    reserve: 40000, horizon: 90, caution: 60, big: 1500, dupDays: 3,
    categories: ["Stock and supplies", "Rent", "Wages", "Taxes", "Marketing",
      "End-of-year payout: owners", "End-of-year payout: managers"],
    nextYearInv: 28000, mgmtPct: 20,
  } : {
    name: "The Scot Shop", type: "Nonprofit-supporting shop",
    goal: "the end-of-year check to the Sports Club",
    reserve: 40000, horizon: 90, caution: 60, big: 1500, dupDays: 3,
    categories: ["Inventory", "Supplies", "Payroll", "Income taxes", "Sales taxes",
      "End-of-year distribution: Sports Club", "End-of-year distribution: management"],
    nextYearInv: 28000, mgmtPct: 20,
  },
  cash: [{ date: "2026-10-26", balance: 71450 }],
  sales: [
    { week: "2026-09-06", net: 1980 }, { week: "2026-09-13", net: 3420 }, { week: "2026-09-20", net: 2610 },
    { week: "2026-09-27", net: 4180 }, { week: "2026-10-04", net: 3150 }, { week: "2026-10-11", net: 2240 },
    { week: "2026-10-18", net: 3870 }, { week: "2026-10-25", net: 2960 },
  ],
  recurring: [
    { id: 1, uid: "r1", name: GENERAL ? "Wages" : "Payroll", cat: GENERAL ? "Wages" : "Payroll", amount: 5200, due: "2026-11-15", freq: "monthly", notes: "" },
    { id: 2, uid: "r2", name: "Sales tax to the state", cat: GENERAL ? "Taxes" : "Sales taxes", amount: 2140, due: "2026-12-20", freq: "quarterly", notes: "" },
  ],
  ledger: [
    { id: 1, uid: "l1", date: "2026-10-02", vendor: GENERAL ? "Penguin Random House" : "Nike", desc: GENERAL ? "autumn order" : "fall team order", cat: GENERAL ? "Stock and supplies" : "Inventory", amount: 4200, status: "paid", due: "", note: "", ok: true },
    { id: 2, uid: "l2", date: "2026-10-09", vendor: GENERAL ? "Shelving Co" : "Jostens", desc: GENERAL ? "a new display table" : "class ring display", cat: GENERAL ? "Stock and supplies" : "Supplies", amount: 310, status: "paid", due: "", note: "", ok: true },
    { id: 3, uid: "l3", date: "2026-10-14", vendor: "UPS", desc: "shipping", cat: GENERAL ? "Stock and supplies" : "Supplies", amount: 86.4, status: "paid", due: "", note: "", ok: true },
    { id: 4, uid: "l4", date: "2026-10-20", vendor: GENERAL ? "Bean Bros Coffee" : "Gatorade", desc: GENERAL ? "cafe stock" : "concession stock", cat: GENERAL ? "Stock and supplies" : "Inventory", amount: 240, status: "paid", due: "", note: "", ok: true },
    { id: 5, uid: "l5", date: "2026-10-22", vendor: GENERAL ? "Bean Bros Coffee" : "Gatorade", desc: GENERAL ? "cafe stock" : "concession stock", cat: GENERAL ? "Stock and supplies" : "Inventory", amount: 240, status: "paid", due: "", note: "", ok: false },
    { id: 6, uid: "l6", date: "2026-10-24", vendor: GENERAL ? "Faber & Faber" : "Russell Athletic", desc: "winter order", cat: GENERAL ? "Stock and supplies" : "Inventory", amount: 2750, status: "unpaid", due: "2026-11-20", note: "", ok: false },
    { id: 7, uid: "l7", date: "2026-10-25", vendor: "Printing Co", desc: GENERAL ? "window posters" : "homecoming banners", cat: GENERAL ? "Stock and supplies" : "Supplies", amount: null, status: "", due: "", note: "", ok: false },
  ],
  mgmt: [{ id: 1, uid: "m1", name: "Store manager", share: 60 }, { id: 2, uid: "m2", name: "Assistant manager", share: 40 }],
  nextId: 8, nextRecId: 3, nextMgmtId: 3, deleted: {},
};

/* ---------- photographing one piece of the page ---------- */
async function shot(name, selector, pad = 14) {
  // The whole page is captured regardless of where it is scrolled, so do NOT scroll to the
  // element: the top bar is sticky, and scrolling down leaves it painted over whatever card
  // we are trying to photograph. Sit at the top and measure in page coordinates.
  const rect = await run(`
    const el = ${selector};
    if (!el) return null;
    window.scrollTo(0, 0);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const r = el.getBoundingClientRect();
    return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height };`);
  if (!rect) { console.log(`  !! ${name}: selector matched nothing`); return false; }
  const clip = {
    x: Math.max(0, rect.x - pad), y: Math.max(0, rect.y - pad),
    width: rect.w + pad * 2, height: rect.h + pad * 2, scale: 2,
  };
  const res = await send("Page.captureScreenshot", { format: "png", clip, captureBeyondViewport: true, fromSurface: true });
  if (!res.result || !res.result.data) { console.log(`  !! ${name}: no image came back`); return false; }
  const file = path.join(OUT, name + ".png");
  fs.writeFileSync(file, Buffer.from(res.result.data, "base64"));
  console.log(`  ${name}.png  ${Math.round(rect.w)}x${Math.round(rect.h)}  ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
  return true;
}
// find a card by the words in its heading
const card = t => `[...document.querySelectorAll('.card')].find(c => (c.querySelector('h2')||{}).textContent && c.querySelector('h2').textContent.toLowerCase().includes(${JSON.stringify(t.toLowerCase())}))`;
const tab = async (name) => { await run(`document.querySelector('[data-tab=${name}]').click(); return true;`); await sleep(350); };

let made = 0, missed = 0;
const take = async (...a) => { (await shot(...a)) ? made++ : missed++; };

console.log(`Photographing ${GENERAL ? "the general site" : "the Scot Shop site"}\n`);

// --- the lock screen, before anything is open ---
await goto();
await run("localStorage.clear(); return true;");
await goto();
await take("lock-screen", "document.querySelector('#lock .lock-card')", 18);

// --- open the example books without a database ------------------------------
// The site normally signs in against Supabase. These pictures must be the same every time
// they are taken and must not touch anybody's real books, so the two things that talk to the
// server are replaced with ones that answer out of this file, and the example books are put
// straight into the page. Nothing here ships: it lives only in this browser, for one run.
await run(`
  window.SPCloud = {
    join:    async () => "example",
    load:    async () => null,
    save:    async () => 1,
    note:    async () => {},
    members: async () => ([{ email: "mollie@example.com", joined_at: "2026-05-02T14:10:00Z" },
                           { email: "shelly@example.com", joined_at: "2026-05-02T16:40:00Z" }]),
    history: async () => ([
      { email: "mollie@example.com", action: "added an expense",        detail: "Nike $1,240.00",        at: "2026-05-14T15:02:00Z" },
      { email: "shelly@example.com", action: "marked an expense paid",  detail: "#38 Printing $410.00",  at: "2026-05-14T11:47:00Z" },
      { email: "mollie@example.com", action: "added a bank balance",    detail: "$41,880.00 on 2026-05-13", at: "2026-05-13T09:15:00Z" },
      { email: "shelly@example.com", action: "signed in",               detail: null,                    at: "2026-05-13T08:58:00Z" },
      { email: "mollie@example.com", action: "changed the settings",    detail: null,                    at: "2026-05-11T17:20:00Z" },
    ]),
    businessId: () => "example", version: () => 1, watch: () => {},
  };
  session = { user: { email: "mollie@example.com" } };
  state = normalizeState(${JSON.stringify(BOOKS)});
  document.querySelector("#whoBadge").textContent = "mollie@example.com";
  document.querySelector("#whoBadge").classList.remove("hidden");
  enterApp();
  return true;`);
for (let i = 0; i < 60; i++) { await sleep(200); if (await run("return !document.body.classList.contains('locked');")) break; }
await sleep(500);

await take("topbar", "document.querySelector('header.topbar')", 0);

console.log("\nHome");
await tab("home");
await take("home-hero", "document.querySelector('#tab-home .hero')");
await take("home-needs-ok", card("needs your ok"));
await take("home-coming-up", card("coming up"));
await take("home-math", card("how we got that number"));

console.log("\nCan we afford it?");
await tab("afford");
await run(`document.getElementById('affordAmount').value='18000';
  document.getElementById('affordWhat').value='a new display case and winter stock';
  document.getElementById('affordForm').dispatchEvent(new Event('submit',{cancelable:true,bubbles:true})); return true;`);
await sleep(500);
await take("afford-form", card("can we afford it"));
await take("afford-answer", "document.querySelector('#affordResult .verdict')");
await take("afford-math", "document.querySelector('#affordResult .card')");

console.log("\nThe year-end checks");
await tab("club");
await take("club", card(GENERAL ? "end-of-year payout" : "sports club"));
await tab("mgmt");
await take("mgmt-split", card(GENERAL ? "end-of-year payout: managers" : "end-of-year distribution: management"));
await take("mgmt-people", card("who gets a check"));

console.log("\nExpenses");
await tab("expenses");
await take("expense-form", card("log an expense"));
await take("expense-list", "document.querySelector('#tab-expenses .card-head').closest('.card') || document.querySelector('#tab-expenses .card-head').parentElement");

console.log("\nBills and sales");
await tab("money");
await take("money-bank", card("money in the bank"));
await take("money-sales", card("weekly sales"));
await take("money-recurring", card("bills that repeat"));

console.log("\nWeekly update and pricing");
await tab("update");
await take("update", card("weekly update"));
await tab("pricing");
await run(`const set=(id,v)=>{const e=document.getElementById(id); e.value=v;};
  set('prName','a hooded sweatshirt'); set('prMat','22'); set('prMin','10'); set('prWage','14');
  set('prOver','3'); set('prPrice','38'); set('prTarget','30');
  document.getElementById('priceForm').dispatchEvent(new Event('input',{bubbles:true})); return true;`);
await sleep(400);
await take("pricing", card("true cost"));

console.log("\nSettings");
await tab("settings");
await take("settings-business", card("your business"));
await take("settings-account", card("your account"));
await take("settings-tabs", card("which pages you want"));
await take("settings-data", card("your data"));

console.log("\nHistory");
await tab("history");
await sleep(600);
await take("history", "document.querySelector('#tab-history')", 10);

console.log(`\n${made} pictures written to guide/img/, ${missed} missing`);
shutdown();
process.exit(missed ? 1 : 0);
