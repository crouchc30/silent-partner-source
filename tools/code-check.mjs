/* The code screens, in a real browser, without needing a real inbox.
 *
 *   node tools/code-check.mjs
 *
 * Reading an actual email is not something a test can do, so the one call that checks the
 * code with Supabase is replaced with one that knows the answer. Everything on this side of
 * it is the real thing: the screens, the stripping of pasted spaces, what each error says,
 * asking for another code, and where you land when it works.
 */
import { spawn } from "node:child_process";
import net from "node:net";
import { fileURLToPath } from "node:url";
const PORT = 8733, CDP = 9733;
// fileURLToPath, not .pathname: this project lives under a folder with a space in its name,
// and .pathname hands back the percent-encoded form, which is not a path any file exists at.
const ROOT = fileURLToPath(new URL("..", import.meta.url));

const server = spawn(process.execPath, ["-e", `
  const http=require("http"),fs=require("fs"),p=require("path");
  const T={".html":"text/html",".js":"text/javascript",".css":"text/css",".png":"image/png"};
  http.createServer((q,s)=>{let f=p.join(${JSON.stringify(ROOT)},q.url.split("?")[0]);
    if(q.url==="/")f=p.join(${JSON.stringify(ROOT)},"index.html");
    if(q.url==="/config.js"){s.writeHead(200,{"content-type":"text/javascript"});
      return s.end('window.SP_CONFIG={supabaseUrl:"https://stub.supabase.co",supabaseAnon:"k",linkWord:"grassmere",shopName:"T"};')}
    fs.readFile(f,(e,d)=>{if(e){s.writeHead(404);return s.end()}s.writeHead(200,{"content-type":T[p.extname(f)]||"text/plain"});s.end(d)})
  }).listen(${PORT});`], { stdio: "ignore" });
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ["--headless=new", `--remote-debugging-port=${CDP}`, `--user-data-dir=/tmp/cc-${process.pid}`,
   "--no-first-run", "--disable-gpu", "--window-size=1100,900", "about:blank"], { stdio: "ignore" });
process.on("exit", () => { try { server.kill(); } catch {} try { chrome.kill(); } catch {} });
const wp = p => new Promise(r => { const t = setInterval(() => { const s = net.connect(p, "127.0.0.1", () => { clearInterval(t); s.end(); r(); }); s.on("error", () => s.destroy()); }, 120); });

let pass = 0, fail = 0;
const ok  = m => { console.log("  ok   " + m); pass++; };
const bad = m => { console.log("  FAIL " + m); fail++; };

await wp(PORT); await wp(CDP);
const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${CDP}/json/new?http://127.0.0.1:${PORT}/`, { method: "PUT" })).json();
const ws = new WebSocket(webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const w = new Map(); const errs = [];
ws.onmessage = e => { const m = JSON.parse(e.data);
  if (m.id && w.has(m.id)) { w.get(m.id)(m.result); w.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown") errs.push(m.params.exceptionDetails.text + " " + (m.params.exceptionDetails.exception?.description || ""));
};
const send = (method, params = {}) => new Promise(r => { const i = ++id; w.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const js = async expr => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  // A silent undefined here sends you hunting through the page for a bug that is in the test.
  if (r.exceptionDetails) throw new Error("in the page: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text) + "\n  while running: " + expr.trim().slice(0, 160));
  return r.result?.value;
};
const pause = ms => new Promise(r => setTimeout(r, ms));
// Wait for the thing to become true rather than sleeping and hoping. A fixed pause passes on
// a quiet machine and fails on a busy one, and a test that fails one run in three teaches
// people to ignore it.
const until = async (expr, ms = 4000) => {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await js(expr).catch(() => false)) return true;
    await pause(60);
  }
  return false;
};
const shown = () => js(`[...document.querySelectorAll("#lock form")].filter(f=>!f.classList.contains("hidden")).map(f=>f.id)[0]`);

await send("Runtime.enable");
// Wait for the page to be ready rather than guessing at a number of milliseconds. A fixed
// sleep passes on a fast morning and fails on a slow one, which is worse than failing always.
for (let i = 0; i < 60; i++) {
  if (await js("!!window.SPAuth && !!document.querySelector('#codeForm')").catch(() => false)) break;
  await pause(100);
}

// Stand in for the three calls that need a server and an inbox.
await js(`
  window.__sent = [];
  SPAuth.signUp     = async (email) => { window.__sent.push(["signup", email]); return { needsConfirm: true }; };
  SPAuth.sendReset  = async (email) => { window.__sent.push(["reset", email]); };
  SPAuth.resendCode = async (email, kind) => { window.__sent.push(["resend", email, kind]); };
  SPAuth.verifyCode = async (email, code, kind) => {
    if (code === "999999") { const e = new Error("Token has expired or is invalid"); throw e; }
    if (code !== "123456") { const e = new Error("Invalid token"); throw e; }
    window.__verified = { email, code, kind }; return {};
  };
  SPAuth.setPassword = async (pw) => { window.__newPw = pw; };
  window.openBooks = async () => { window.__opened = true; document.body.classList.remove("locked"); };
  true`);

console.log("\nSigning up asks for a code, not a link");
await js(`SPAuth.tryGate("grassmere"); screen("signinForm"); document.querySelector("#toSignup").click()`);
await pause(200);
await js(`document.querySelector("#suEmail").value="mollie@example.com";
  document.querySelector("#suPw").value="a-long-passphrase";
  document.querySelector("#suPw2").value="a-long-passphrase";
  document.querySelector("#signupForm").dispatchEvent(new Event("submit",{cancelable:true}))`);
await until(`!document.querySelector("#codeForm").classList.contains("hidden")`);
(await shown()) === "codeForm" ? ok("after signing up you land on the code screen") : bad("landed on " + await shown());
(await js(`document.querySelector("#codeWhere").textContent`)) === "mollie@example.com" ? ok("and it says which address it went to") : bad("wrong address shown");

console.log("\nTyping the code");
await js(`document.querySelector("#codeInput").value=" 12 34 56 ";
  document.querySelector("#codeInput").dispatchEvent(new Event("input",{bubbles:true}))`);
await pause(150);
(await js(`document.querySelector("#codeInput").value`)) === "123456" ? ok("a code pasted with spaces in it is cleaned up") : bad("value is " + await js(`document.querySelector("#codeInput").value`));

await js(`document.querySelector("#codeInput").value="12";
  document.querySelector("#codeForm").dispatchEvent(new Event("submit",{cancelable:true}))`);
await until(`document.querySelector("#codeErr").textContent.length > 0`);
(await js(`document.querySelector("#codeErr").textContent`)).includes("too short") ? ok("a half-typed code is caught before asking the server") : bad("no complaint about a short code");

await js(`document.querySelector("#codeInput").value="111111";
  document.querySelector("#codeForm").dispatchEvent(new Event("submit",{cancelable:true}))`);
await until(`document.querySelector("#codeErr").textContent.length > 0`);
(await js(`document.querySelector("#codeErr").textContent`)).toLowerCase().includes("isn") ? ok("a wrong code says so in plain words") : bad("wrong-code message: " + await js(`document.querySelector("#codeErr").textContent`));

await js(`document.querySelector("#codeInput").value="999999";
  document.querySelector("#codeForm").dispatchEvent(new Event("submit",{cancelable:true}))`);
await until(`document.querySelector("#codeErr").textContent.toLowerCase().includes("expired")`);
(await js(`document.querySelector("#codeErr").textContent`)).toLowerCase().includes("expired") ? ok("an expired code says to ask for another") : bad("expired message: " + await js(`document.querySelector("#codeErr").textContent`));

console.log("\nAsking for another");
await js(`document.querySelector("#codeResend").click()`);
await until(`!document.querySelector("#codeOk").classList.contains("hidden")`);
(await js(`!document.querySelector("#codeOk").classList.contains("hidden")`)) ? ok("it confirms a new one was sent") : bad("no confirmation after resend");
(await js(`JSON.stringify(window.__sent.at(-1))`)) === '["resend","mollie@example.com","signup"]' ? ok("and asks for the right kind, for the right address") : bad("resent " + await js(`JSON.stringify(window.__sent.at(-1))`));

console.log("\nThe right code");
await js(`document.querySelector("#codeInput").value="123456";
  document.querySelector("#codeForm").dispatchEvent(new Event("submit",{cancelable:true}))`);
await until(`window.__opened === true`);
(await js(`window.__opened === true`)) ? ok("a good code opens the books")
  : bad("did not open the books. codeErr=" + JSON.stringify(await js(`document.querySelector("#codeErr").textContent`))
        + " stubInstalled=" + await js(`window.openBooks && window.openBooks.toString().includes("__opened")`));
(await js(`window.__verified && window.__verified.kind`)) === "signup" ? ok("checked as a sign-up") : bad("wrong kind");

console.log("\nForgetting a password");
await js(`window.__opened=false; document.body.classList.add("locked");
  screen("forgotForm"); document.querySelector("#fpEmail").value="shelly@example.com";
  document.querySelector("#forgotForm").dispatchEvent(new Event("submit",{cancelable:true}))`);
await until(`!document.querySelector("#codeForm").classList.contains("hidden")`);
(await shown()) === "codeForm" ? ok("a reset asks for a code too") : bad("landed on " + await shown());

await js(`document.querySelector("#codeInput").value="123456";
  document.querySelector("#codeForm").dispatchEvent(new Event("submit",{cancelable:true}))`);
await until(`!document.querySelector("#newPwForm").classList.contains("hidden")`);
(await shown()) === "newPwForm" ? ok("a good reset code leads to picking a new password") : bad("landed on " + await shown());
(await js(`window.__verified.kind`)) === "recovery" ? ok("checked as a recovery, not a sign-up") : bad("wrong kind: " + await js(`window.__verified.kind`));

await js(`document.querySelector("#npPw").value="one"; document.querySelector("#npPw2").value="two";
  document.querySelector("#newPwForm").dispatchEvent(new Event("submit",{cancelable:true}))`);
await until(`document.querySelector("#npErr").textContent.length > 0`);
(await js(`document.querySelector("#npErr").textContent`)).includes("match") ? ok("two different passwords are refused") : bad("mismatch not caught");

await js(`document.querySelector("#npPw").value="a-brand-new-passphrase"; document.querySelector("#npPw2").value="a-brand-new-passphrase";
  document.querySelector("#newPwForm").dispatchEvent(new Event("submit",{cancelable:true}))`);
await until(`window.__opened === true`);
(await js(`window.__newPw`)) === "a-brand-new-passphrase" ? ok("the new password is saved") : bad("password not saved");
(await js(`window.__opened === true`)) ? ok("and you are taken straight into the books") : bad("not signed in afterwards");

console.log("\nNothing threw");
errs.length === 0 ? ok("no errors in the console") : bad("console errors:\n       " + errs.join("\n       "));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
