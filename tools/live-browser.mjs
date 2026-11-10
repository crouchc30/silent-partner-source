/* The deployed site, in a real browser, signed in as a real account.
 *
 *   node tools/live-browser.mjs https://scotshopsilentpartner.netlify.app
 *
 * Everything else tests a piece. This tests the thing itself: the address a person types,
 * the word at the door, a real sign-in against the real database, a change that has to
 * survive a reload, and the History tab showing who made it.
 */
import { spawn } from "node:child_process";
const SITE = process.argv[2];
const CDP = 9777;
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ["--headless=new", `--remote-debugging-port=${CDP}`, `--user-data-dir=/tmp/lb-${process.pid}`,
   "--no-first-run", "--disable-gpu", "--window-size=1200,900", "about:blank"], { stdio: "ignore" });
process.on("exit", () => { try { chrome.kill(); } catch {} });

const wait = p => new Promise(r => { const n=require1("net"); const t=setInterval(()=>{const s=n.connect(p,"127.0.0.1",()=>{clearInterval(t);s.end();r()});s.on("error",()=>s.destroy())},150); });
function require1(m){ return globalThis.__net || (globalThis.__net = null); }
import net from "node:net";
const waitPort = p => new Promise(r => { const t=setInterval(()=>{const s=net.connect(p,"127.0.0.1",()=>{clearInterval(t);s.end();r()});s.on("error",()=>s.destroy())},150); });

let pass=0, fail=0;
const ok  = m => { console.log("  ok   " + m); pass++; };
const bad = m => { console.log("  FAIL " + m); fail++; };

await waitPort(CDP);
const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${CDP}/json/new?${SITE}/`, { method:"PUT" })).json();
const ws = new WebSocket(webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id=0; const w=new Map(); const errs=[];
ws.onmessage = e => { const m=JSON.parse(e.data);
  if(m.id&&w.has(m.id)){w.get(m.id)(m.result);w.delete(m.id);}
  if(m.method==="Runtime.exceptionThrown") errs.push(m.params.exceptionDetails.text+" "+(m.params.exceptionDetails.exception?.description||""));
};
const send=(method,params={})=>new Promise(res=>{const i=++id;w.set(i,res);ws.send(JSON.stringify({id:i,method,params}))});
const js = async expr => (await send("Runtime.evaluate",{expression:expr,returnByValue:true,awaitPromise:true})).result?.value;
const pause = ms => new Promise(r=>setTimeout(r,ms));

await send("Runtime.enable"); await send("Page.enable");
await pause(2500);

console.log("\nThe address works");
(await js("document.title")).includes("Silent Partner") ? ok("the page is Silent Partner") : bad("wrong page");
(await js(`[...document.querySelectorAll("#lock form")].filter(f=>!f.classList.contains("hidden")).map(f=>f.id)[0]`)) === "gateForm"
  ? ok("a stranger sees the word prompt") : bad("wrong first screen");

console.log("\nThe word, then a real account");
await js(`document.querySelector("#gateWord").value="grassmere";document.querySelector("#gateForm").dispatchEvent(new Event("submit",{cancelable:true}))`);
await pause(300);
(await js(`!document.querySelector("#signinForm").classList.contains("hidden")`)) ? ok("the word opens sign-in") : bad("sign-in did not appear");

await js(`document.querySelector("#siEmail").value="mollie-test@scotshop.test";document.querySelector("#siPw").value="test-passphrase-one";document.querySelector("#signinForm").dispatchEvent(new Event("submit",{cancelable:true}))`);
await pause(4000);
(await js(`!document.body.classList.contains("locked")`)) ? ok("signed in against the real database") : bad("still locked: " + await js(`document.querySelector("#siErr").textContent`));
(await js(`document.querySelector("#whoBadge").textContent`)) === "mollie-test@scotshop.test" ? ok("the top bar names who is signed in") : bad("no name in the top bar");

console.log("\nA change that has to survive");
const stamp = "Browser test " + Date.now();
await js(`showTab("expenses");
  document.querySelector("#exDate").value="2026-11-10";
  document.querySelector("#exVendor").value=${JSON.stringify(stamp)};
  document.querySelector("#exAmount").value="42.50";
  document.querySelector("#exStatus").value="paid";
  document.querySelector("#expenseForm").dispatchEvent(new Event("submit",{cancelable:true}))`);
await pause(3000);
(await js(`state.ledger.some(r=>r.vendor===${JSON.stringify(stamp)})`)) ? ok("the entry is on screen") : bad("entry never appeared");

await send("Page.reload"); await pause(5000);
(await js(`!document.body.classList.contains("locked")`)) ? ok("still signed in after a reload") : bad("reload signed us out");
(await js(`state && state.ledger.some(r=>r.vendor===${JSON.stringify(stamp)})`)) ? ok("and the entry came back from the server") : bad("the entry did not survive");

console.log("\nHistory");
await js(`showTab("history")`); await pause(2500);
const rows = await js(`document.querySelectorAll("#histRows tr").length`);
rows > 0 ? ok(`History has ${rows} rows`) : bad("History is empty");
(await js(`document.querySelector("#histRows").textContent.includes("mollie-test@scotshop.test")`)) ? ok("it names Mollie") : bad("no name in History");
(await js(`document.querySelector("#histRows").textContent.includes("added an expense")`)) ? ok("and says what she did") : bad("no action recorded");

console.log("\nSigning out");
await js(`document.querySelector("#lockBtn").click()`); await pause(3500);
(await js(`document.body.classList.contains("locked")`)) ? ok("sign out locks the page") : bad("still showing the books after sign out");

console.log("\nNothing threw");
errs.length===0 ? ok("no errors in the console") : bad("console errors:\n       "+errs.join("\n       "));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
