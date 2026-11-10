/* Proof that two devices sharing one repository end up with the same books.
 *
 *   node tools/sync-roundtrip.mjs
 *
 * This runs the real merge.js and the real sync.js, each in its own sandbox with its own
 * localStorage, the way two different computers would. GitHub is replaced by an in-memory file
 * with the same rules the real Contents API enforces: you must send the sha you last read, and
 * you get a 409 if someone else committed in the meantime.
 *
 * What it cannot prove: that a real fine-grained token has the right permissions, or that
 * github.com answers the way this fake does. Those only show up against the real thing. See
 * SETUP-SYNC.md for how to confirm that part by hand.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const mergeSrc = readFileSync(path.join(root, "merge.js"), "utf8");
const syncSrc = readFileSync(path.join(root, "sync.js"), "utf8");

let pass = 0, fail = 0;
const check = (name, cond, detail) => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? "\n       " + detail : ""}`); }
};

/* ---------- a stand-in for the repository ---------- */
const repo = { file: null, sha: null, commits: [], rejected: 0 };
let shaCounter = 0;
const newSha = () => `sha${++shaCounter}`;

function fakeFetch(url, opts = {}) {
  const method = opts.method || "GET";
  const auth = (opts.headers || {}).Authorization || "";
  if (!/^Bearer \S+/.test(auth)) return json(401, { message: "Bad credentials" });

  if (/\/contents\//.test(url)) {
    if (method === "GET") {
      if (!repo.file) return json(404, { message: "Not Found" });
      return json(200, { sha: repo.sha, content: Buffer.from(repo.file, "utf8").toString("base64") });
    }
    if (method === "PUT") {
      const body = JSON.parse(opts.body);
      // The real API refuses a write that isn't based on the version you last read.
      if (repo.file && body.sha !== repo.sha) {
        repo.rejected++;
        return json(409, { message: "is at " + repo.sha + " but expected " + body.sha });
      }
      if (!repo.file && body.sha) return json(422, { message: "sha given for a new file" });
      repo.file = Buffer.from(body.content, "base64").toString("utf8");
      repo.sha = newSha();
      repo.commits.push(body.message);
      return json(200, { content: { sha: repo.sha } });
    }
  }
  // the repo metadata probe used by "Check and turn on"
  return json(200, { full_name: "crouchc30/silent-partner-books", private: true, default_branch: "main", permissions: { push: true } });
}
const json = (status, body) => Promise.resolve({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(body),
});

/* ---------- a stand-in for one computer ---------- */
function makeDevice(label) {
  const store = new Map();
  const localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
  };
  const ctx = {
    console, crypto, TextEncoder, TextDecoder, fetch: fakeFetch,
    btoa: s => Buffer.from(s, "binary").toString("base64"),
    atob: s => Buffer.from(s, "base64").toString("binary"),
    setTimeout, clearTimeout, setInterval, clearInterval,
    localStorage,
    navigator: { userAgent: label },
    document: { hidden: false, addEventListener() {} },
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(mergeSrc + "\n;" + syncSrc, ctx);
  ctx.SPSync.setDeviceLabel(label);
  ctx.SPSync.saveConfig({ owner: "crouchc30", repo: "silent-partner-books", path: "vault.json", branch: "main", token: "github_pat_test", enabled: true });
  return ctx;
}

/* ---------- the same encryption the site uses, at test speed ---------- */
const ITER = 1000; // the site ships 310000; the maths is identical, this just keeps the test quick
const SALT = new Uint8Array(16).fill(7);
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = b => Buffer.from(b).toString("base64");
const unb64 = s => new Uint8Array(Buffer.from(s, "base64"));

async function keyFor(password) {
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: SALT, iterations: ITER, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function seal(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(obj)));
  return { app: "silent-partner", v: 1, iter: ITER, salt: b64(SALT), iv: b64(iv), ct: b64(new Uint8Array(ct)) };
}
async function open(key, vault) {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(vault.iv) }, key, unb64(vault.ct));
  return JSON.parse(dec.decode(pt));
}

const books = (rows) => ({
  settings: { name: "Scot Shop", reserve: 1500, horizon: 90, caution: 75, categories: ["Inventory"] },
  ledger: rows, cash: [], sales: [], recurring: [], mgmt: [],
  nextId: rows.length + 1, nextRecId: 1, nextMgmtId: 1, deleted: {},
});
const expense = (uid, vendor, amount, touched) => ({ id: 1, uid, date: "2026-11-01", vendor, desc: "", amount, status: "paid", ok: true, touched });

// Hand sync.js the same hooks app.js does.
function wire(ctx, key, holder) {
  let savedAt = "";
  ctx.SPSync.start({
    hasSession: () => true,
    usesSharedPassword: () => holder.shared === true,
    getState: () => holder.state,
    localSavedAt: () => savedAt,
    seal: async () => { savedAt = new Date().toISOString(); return seal(key, holder.state); },
    decrypt: (vault) => open(key, vault),
    applyMerged: (merged) => { holder.state = merged; },
  });
  return { bumpSaved: () => { savedAt = new Date().toISOString(); } };
}

const vendors = s => s.ledger.map(r => r.vendor).sort().join(",");

async function main() {
  const key = await keyFor("a long passphrase of her own");

  console.log("\nDevice A saves for the first time");
  const A = makeDevice("Shop iPad");
  const holderA = { state: books([expense("u-a", "Nike", 400, "2026-11-02T09:00:00.000Z")]) };
  wire(A, key, holderA);
  await A.SPSync.syncNow();
  check("a file appears in the repository", !!repo.file);
  check("the commit message names the device", /Shop iPad/.test(repo.commits[0] || ""), repo.commits[0]);
  const onRepo1 = JSON.parse(repo.file);
  check("what's stored is ciphertext, not numbers", !!onRepo1.ct && !/Nike/.test(repo.file));
  check("it records when and from where", !!onRepo1.savedAt && onRepo1.savedBy === "Shop iPad");
  check("the password is nowhere in the file", !/passphrase/.test(repo.file));

  console.log("\nDevice B opens the link on another computer");
  const B = makeDevice("Back office Mac");
  const holderB = { state: books([]) };
  const got = await B.SPSync.prefetch();
  check("B finds the books A saved", !!got && !!got.ct);
  const cands = B.SPSync.unlockCandidates(null);
  check("with nothing local, the repository copy is what B unlocks", cands.length === 1 && cands[0].from === "github");
  holderB.state = await open(key, got);
  check("B can read A's entry", vendors(holderB.state) === "Nike", vendors(holderB.state));
  B.SPSync.noteAdopted(got);
  wire(B, key, holderB);

  console.log("\nBoth type at once, then both save");
  holderA.state.ledger.push(expense("u-b", "UPS", 60, "2026-11-03T09:00:00.000Z"));
  holderB.state.ledger.push(expense("u-c", "Coca-Cola", 220, "2026-11-03T10:00:00.000Z"));
  await A.SPSync.syncNow();
  await B.SPSync.syncNow();
  const after = await open(key, JSON.parse(repo.file));
  check("the repository holds all three entries", vendors(after) === "Coca-Cola,Nike,UPS", vendors(after));
  check("B's own books picked up A's entry too", vendors(holderB.state) === "Coca-Cola,Nike,UPS", vendors(holderB.state));

  console.log("\nA pulls and catches up");
  await A.SPSync.pull();
  check("A now has all three as well", vendors(holderA.state) === "Coca-Cola,Nike,UPS", vendors(holderA.state));

  console.log("\nA deletes an entry, B still has it");
  holderA.state.ledger = holderA.state.ledger.filter(r => r.uid !== "u-b");
  holderA.state.deleted["u-b"] = new Date().toISOString();
  await A.SPSync.syncNow();
  await B.SPSync.pull();
  check("the delete reaches B instead of being undone", vendors(holderB.state) === "Coca-Cola,Nike", vendors(holderB.state));

  console.log("\nA stale write is refused and retried, not forced through");
  const before = repo.rejected;
  holderA.state.ledger.push(expense("u-d", "Fanatics", 95, new Date().toISOString()));
  holderB.state.ledger.push(expense("u-e", "Gatorade", 40, new Date().toISOString()));
  // Make A's view of the file stale on purpose, the way a slow connection would.
  await Promise.all([A.SPSync.syncNow(), B.SPSync.syncNow()]);
  await A.SPSync.pull();
  await B.SPSync.pull();
  const final = await open(key, JSON.parse(repo.file));
  check("both late entries survived the collision", /Fanatics/.test(vendors(final)) && /Gatorade/.test(vendors(final)), vendors(final));
  check("A and B agree with the repository", vendors(holderA.state) === vendors(final) && vendors(holderB.state) === vendors(final),
    `A=${vendors(holderA.state)}\n       B=${vendors(holderB.state)}\n       repo=${vendors(final)}`);
  if (repo.rejected > before) console.log(`       (the fake API refused ${repo.rejected - before} stale write${repo.rejected - before === 1 ? "" : "s"}, which is the path being tested)`);

  console.log("\nBooks still on the shared password are not uploaded");
  const C = makeDevice("Someone's laptop");
  const holderC = { state: books([expense("u-z", "Secret", 1, new Date().toISOString())]), shared: true };
  wire(C, key, holderC);
  const commitsBefore = repo.commits.length;
  await C.SPSync.syncNow();
  check("nothing was written", repo.commits.length === commitsBefore);
  check("and the page says why", C.SPSync.status().state === "blocked", JSON.stringify(C.SPSync.status()));

  console.log("\nA bad token is reported, and the books are left alone");
  const D = makeDevice("Typo machine");
  D.SPSync.saveConfig({ owner: "crouchc30", repo: "silent-partner-books", path: "vault.json", branch: "main", token: "", enabled: true });
  const holderD = { state: books([]) };
  wire(D, key, holderD);
  await D.SPSync.syncNow();
  check("sync is off without a token", !D.SPSync.isOn());

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
