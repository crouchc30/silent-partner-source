/* Does the page load, and does the front door appear?
 *
 *   node tools/smoke.mjs
 *
 * This cannot test signing in -- that needs a real Supabase project -- so it tests the part
 * that must work before anyone gets that far: the files parse, the scripts run, nothing
 * throws on load, and the word prompt is the thing a visitor sees.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import net from "node:net";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 8711, CDP = 9711;

const server = spawn(process.execPath, ["-e", `
  const http=require("http"),fs=require("fs"),p=require("path");
  const T={".html":"text/html",".js":"text/javascript",".css":"text/css",".json":"application/json"};
  http.createServer((q,s)=>{let f=p.join(${JSON.stringify(ROOT)},q.url.split("?")[0]);
    if(q.url==="/")f=p.join(${JSON.stringify(ROOT)},"index.html");
    // Stand-in settings, so the front door is exercised. Nothing talks to this host.
    if(q.url==="/config.js"){s.writeHead(200,{"content-type":"text/javascript"});
      return s.end('window.SP_CONFIG={supabaseUrl:"https://stub.supabase.co",supabaseAnon:"stub-anon-key",linkWord:"grassmere",shopName:"Test Shop"};')}
    fs.readFile(f,(e,d)=>{if(e){s.writeHead(404);return s.end()}s.writeHead(200,{"content-type":T[p.extname(f)]||"text/plain"});s.end(d)})
  }).listen(${PORT});`], { stdio: "ignore" });

const profile = `/tmp/sp-smoke-${process.pid}`;
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${CDP}`,
  `--user-data-dir=${profile}`, "--no-first-run", "--disable-gpu", "about:blank"], { stdio: "ignore" });

const die = () => { try { server.kill(); } catch {} try { chrome.kill(); } catch {} };
process.on("exit", die);

const wait = (port) => new Promise(res => {
  const t = setInterval(() => {
    const s = net.connect(port, "127.0.0.1", () => { clearInterval(t); s.end(); res(); });
    s.on("error", () => s.destroy());
  }, 120);
});

let pass = 0, fail = 0;
const ok  = (m) => { console.log("  ok   " + m); pass++; };
const bad = (m) => { console.log("  FAIL " + m); fail++; };

await wait(PORT); await wait(CDP);
const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${CDP}/json/new?http://127.0.0.1:${PORT}/`, { method: "PUT" })).json();
const ws = new WebSocket(webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);

let id = 0; const waiters = new Map(); const errors = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && waiters.has(m.id)) { waiters.get(m.id)(m.result); waiters.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.text + " " + (m.params.exceptionDetails.exception?.description || ""));
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map(a => a.value || a.description).join(" "));
};
const send = (method, params = {}) => new Promise(res => { const i = ++id; waiters.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const evalJs = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result?.value;

await send("Runtime.enable");
await send("Page.enable");
await new Promise(r => setTimeout(r, 1800));

console.log("\nThe page loads");
(await evalJs("document.title")).includes("Silent Partner") ? ok("it is Silent Partner") : bad("wrong title");
(await evalJs("!!window.supabase")) ? ok("the supabase library loaded from our own server") : bad("supabase library missing");
(await evalJs("!!window.SPAuth")) ? ok("auth.js ran") : bad("auth.js did not run");
(await evalJs("!!window.SPCloud")) ? ok("cloud.js ran") : bad("cloud.js did not run");
(await evalJs("!!window.SPMerge")) ? ok("merge.js still there, for two people at once") : bad("merge.js missing");

console.log("\nWhat a visitor sees first");
const shown = await evalJs(`[...document.querySelectorAll("#lock form")].filter(f=>!f.classList.contains("hidden")).map(f=>f.id)`);
JSON.stringify(shown) === '["gateForm"]' ? ok("the word prompt, and nothing else") : bad("expected only gateForm, got " + JSON.stringify(shown));
(await evalJs(`document.body.classList.contains("locked")`)) ? ok("the books are not on screen") : bad("page is not locked");
(await evalJs(`!!document.querySelector('[data-tab="history"]')`)) ? ok("a History tab exists") : bad("no History tab");
(await evalJs(`!!document.querySelector("#tab-history")`)) ? ok("and a History page to go with it") : bad("no History section");

console.log("\nThe word at the door");
await evalJs(`document.querySelector("#gateWord").value = "GRASSMERE  "; document.querySelector("#gateForm").dispatchEvent(new Event("submit",{cancelable:true}))`);
await new Promise(r => setTimeout(r, 250));
const after = await evalJs(`[...document.querySelectorAll("#lock form")].filter(f=>!f.classList.contains("hidden")).map(f=>f.id)`);
JSON.stringify(after) === '["signinForm"]' ? ok("the right word, typed shouty with stray spaces, opens sign-in") : bad("expected signinForm, got " + JSON.stringify(after));
await evalJs(`localStorage.removeItem("sp.gate.v1")`);

console.log("\nThe old single-password machinery is gone");
(await evalJs("typeof BLANK_VAULT === 'undefined'")) ? ok("no shared vault ships with the site") : bad("blank-vault.js still loaded");
(await evalJs("!window.SPSync")) ? ok("no GitHub token sync") : bad("sync.js still loaded");
(await evalJs(`!document.querySelector("#syncForm")`)) ? ok("no GitHub form in Settings") : bad("sync form still in Settings");

console.log("\nNothing threw");
errors.length === 0 ? ok("no errors in the console") : bad("console errors:\n       " + errors.join("\n       "));

console.log(`\n${pass} passed, ${fail} failed`);
die();
process.exit(fail ? 1 : 0);
