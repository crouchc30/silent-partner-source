/* Checks the walkthrough actually works: every page shows, every picture loads, the buttons and
 * the keyboard both move you along, and the links between the guide and the site resolve.
 *
 *   node tools/guide-check.mjs
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import net from "node:net";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(res => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });
const PORT = await freePort(), CDP = await freePort();
const profile = path.join("/tmp", `sp-guide-${process.pid}`);
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1", "--directory", ROOT], { stdio: "ignore" });
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`,
  "--no-first-run", "--no-default-browser-check", "--disable-gpu", "about:blank"], { stdio: "ignore" });
const shutdown = () => { try { server.kill(); } catch {} try { chrome.kill(); } catch {} };
process.on("exit", shutdown);

let pass = 0, fail = 0;
const check = (n, c, d) => { if (c) { pass++; console.log(`  ok   ${n}`); } else { fail++; console.log(`  FAIL ${n}${d ? "\n       " + d : ""}`); } };

let targets;
for (let i = 0; i < 40; i++) { try { targets = await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json(); if (targets.some(t => t.type === "page")) break; } catch {} await sleep(250); }
const ws = new WebSocket(targets.find(t => t.type === "page").webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener("open", r, { once: true }));
let id = 0; const waiting = new Map(); const events = [];
ws.addEventListener("message", e => { const m = JSON.parse(e.data); if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); } else if (m.method) events.push(m); });
const send = (method, params = {}) => new Promise(res => { const n = ++id; waiting.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });
await send("Page.enable"); await send("Runtime.enable"); await send("Log.enable");
const run = async expr => {
  const r = await send("Runtime.evaluate", { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true });
  if (r.result && r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails.exception || {}));
  return r.result && r.result.result ? r.result.result.value : undefined;
};
const IGNORE = /favicon/i;
const errs = () => events.filter(e => e.method === "Log.entryAdded" && e.params.entry.level === "error")
  .map(e => `${e.params.entry.text} [${e.params.entry.url || ""}]`)
  .concat(events.filter(e => e.method === "Runtime.exceptionThrown").map(e => e.params.exceptionDetails.text))
  .filter(t => !IGNORE.test(t));
const goto = async (p) => {
  await send("Page.navigate", { url: `http://localhost:${PORT}/${p}` });
  for (let i = 0; i < 80; i++) { await sleep(150); if (await run("return document.readyState==='complete';").catch(() => false)) return; }
};

console.log("The walkthrough\n");
await goto("guide.html");
await sleep(600);
const total = await run("return document.querySelectorAll('.slide').length;");
check(`all pages are there (${total})`, total >= 25, `found ${total}`);
check("exactly one page is showing at a time", await run("return document.querySelectorAll('.slide.on').length === 1;"));
check("it starts on page 1", await run("return document.querySelector('.slide.on').dataset.i === '0';"));
check("no JavaScript errors", errs().length === 0, errs().join("\n       "));

console.log("\nEvery picture");
// Visit every page so the lazy-loaded pictures are all fetched. Done by address, not by
// pressing Next: the button on the final page deliberately leaves for the site itself.
for (let i = 1; i <= total; i++) { await run(`location.hash = '#p${i}'; return true;`); await sleep(110); }
await sleep(1200);
const imgs = await run(`
  const out = [];
  for (const im of document.images) { if (!im.complete || im.naturalWidth === 0) out.push(im.getAttribute('src')); }
  return { total: document.images.length, broken: out };`);
check(`all ${imgs.total} pictures loaded`, imgs.broken.length === 0, "broken: " + imgs.broken.join(", "));
check("every picture has alt text for a screen reader", await run(`return [...document.images].every(i => (i.alt||'').trim().length > 0);`));
check("every picture is marked as an example", await run(`
  const figs = [...document.querySelectorAll('figure.shot')];
  const unlabelled = figs.filter(f => !f.querySelector('.example-tag') && !/lock-screen|topbar|settings-password|banner-shared|settings-sync|settings-data|settings-business/.test(f.querySelector('img').src));
  return unlabelled.length === 0;`));

console.log("\nMoving through it");
await run("location.hash = '#p12'; return true;"); await sleep(250);
await run("document.querySelector('.contents-item').click(); return true;"); await sleep(300);
check("the contents list jumps to the page you pick", await run("return document.querySelector('.slide.on').dataset.i === '0';"));
await run("document.getElementById('contentsBtn').click(); return true;"); await sleep(200);
check("the contents list opens", await run("return !document.getElementById('contents').classList.contains('hidden');"));
check("it lists every page", await run(`return document.querySelectorAll('.contents-item').length === ${total};`));
await run("document.getElementById('contentsClose').click(); return true;"); await sleep(200);
check("and closes again", await run("return document.getElementById('contents').classList.contains('hidden');"));

await run(`document.body.focus(); document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})); return true;`);
await sleep(250);
check("the right arrow key moves forward", await run("return document.querySelector('.slide.on').dataset.i === '1';"));
await run(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true})); return true;`);
await sleep(250);
check("the left arrow key moves back", await run("return document.querySelector('.slide.on').dataset.i === '0';"));
check("Back is switched off on the first page", await run("return document.getElementById('prevBtn').disabled === true;"));

await run(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true})); return true;`);
await sleep(300);
check("the End key goes to the last page", await run(`return document.querySelector('.slide.on').dataset.i === '${total - 1}';`));
check("the progress bar is full at the end", await run("return parseFloat(document.getElementById('bar').style.width) > 99;"));
check("the last button opens the site itself", await run("return /Open Silent Partner/.test(document.getElementById('nextBtn').textContent);"));

console.log("\nIt remembers, and can be linked to");
await goto("guide.html#p7");
await sleep(500);
check("a link to one page opens that page", await run("return document.querySelector('.slide.on').dataset.i === '6';"));
await goto("guide.html");
await sleep(500);
check("coming back returns you to where you stopped", await run("return document.querySelector('.slide.on').dataset.i === '6';"));

console.log("\nThe site links to the guide");
await goto("index.html");
await sleep(500);
check("the lock screen offers the walkthrough", await run("return !!document.querySelector('.guide-link') && document.querySelector('.guide-link').getAttribute('href') === 'guide.html';"));
check("the top bar has a help link", await run("return !!document.getElementById('helpLink');"));
check("the site still loads without errors", errs().length === 0, errs().join("\n       "));

console.log(`\n${pass} passed, ${fail} failed`);
shutdown();
process.exit(fail ? 1 : 0);
