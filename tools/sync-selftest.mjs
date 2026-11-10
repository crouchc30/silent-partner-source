/* Proof that merging two sets of books never quietly loses somebody's work.
 *
 *   node tools/sync-selftest.mjs
 *
 * Exits 0 if every case passes, 1 if any fails. No network and no browser: this runs the real
 * merge.js the site ships, against hand-built pairs of books.
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { mergeBooks } = require(path.join(here, "..", "merge.js"));

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? "\n       " + detail : ""}`); }
}
function section(s) { console.log(`\n${s}`); }

const T = {
  mon: "2026-11-02T09:00:00.000Z",
  tue: "2026-11-03T09:00:00.000Z",
  wed: "2026-11-04T09:00:00.000Z",
  thu: "2026-11-05T09:00:00.000Z",
};

function books(extra = {}) {
  return Object.assign({
    settings: { name: "Scot Shop", reserve: 1500, horizon: 90, caution: 75, categories: ["Inventory"] },
    ledger: [], cash: [], sales: [], recurring: [], mgmt: [],
    nextId: 1, nextRecId: 1, nextMgmtId: 1, deleted: {},
  }, extra);
}
const row = (o) => Object.assign({ id: 1, date: "2026-11-01", vendor: "", desc: "", amount: 0, status: "paid" }, o);
const names = (rows) => rows.map(r => `${r.vendor || r.name || r.date || r.week}`).sort().join(",");

section("Two people typing at once");
{
  const mine = books({ ledger: [row({ uid: "u-a", id: 1, vendor: "Nike", amount: 400, touched: T.mon })], nextId: 2 });
  const theirs = books({ ledger: [row({ uid: "u-b", id: 1, vendor: "UPS", amount: 60, touched: T.tue })], nextId: 2 });
  const m = mergeBooks({ state: mine, savedAt: T.mon }, { state: theirs, savedAt: T.tue });
  check("both entries survive", m.state.ledger.length === 2, `got ${names(m.state.ledger)}`);
  check("the other person's entry is reported as new", m.added === 1, `added=${m.added}`);
  check("id counter clears both rows", m.state.nextId === 2, `nextId=${m.state.nextId}`);
}

section("The same row edited in two places");
{
  const mine = books({ ledger: [row({ uid: "u-a", vendor: "Nike", amount: 400, touched: T.wed })] });
  const theirs = books({ ledger: [row({ uid: "u-a", vendor: "Nike", amount: 450, touched: T.mon })] });
  const m = mergeBooks({ state: mine, savedAt: T.wed }, { state: theirs, savedAt: T.thu });
  check("not duplicated", m.state.ledger.length === 1, `got ${m.state.ledger.length} rows`);
  check("the newer edit wins even though their file was saved later",
    m.state.ledger[0].amount === 400, `amount=${m.state.ledger[0].amount}`);
}
{
  const mine = books({ ledger: [row({ uid: "u-a", vendor: "Nike", amount: 400, touched: T.mon })] });
  const theirs = books({ ledger: [row({ uid: "u-a", vendor: "Nike", amount: 450, touched: T.thu })] });
  const m = mergeBooks({ state: mine, savedAt: T.mon }, { state: theirs, savedAt: T.thu });
  check("their newer edit replaces mine", m.state.ledger[0].amount === 450, `amount=${m.state.ledger[0].amount}`);
  check("counted as an update, not an add", m.updated === 1 && m.added === 0, `added=${m.added} updated=${m.updated}`);
}

section("Deleting stays deleted");
{
  const mine = books({ ledger: [], deleted: { "u-a": T.wed } });
  const theirs = books({ ledger: [row({ uid: "u-a", vendor: "Nike", touched: T.mon })] });
  const m = mergeBooks({ state: mine, savedAt: T.wed }, { state: theirs, savedAt: T.tue });
  check("a row I deleted does not come back from the other device",
    m.state.ledger.length === 0, `got ${names(m.state.ledger)}`);
}
{
  const mine = books({ ledger: [], deleted: { "u-a": T.mon } });
  const theirs = books({ ledger: [row({ uid: "u-a", vendor: "Nike", touched: T.thu })] });
  const m = mergeBooks({ state: mine, savedAt: T.mon }, { state: theirs, savedAt: T.thu });
  check("but re-entering it afterwards sticks", m.state.ledger.length === 1, `got ${names(m.state.ledger)}`);
}

section("Books written before sync existed (no uid)");
{
  const legacy = row({ id: 7, vendor: "Nike", desc: "fall order", amount: 400 });
  const mine = books({ ledger: [JSON.parse(JSON.stringify(legacy))], nextId: 8 });
  const theirs = books({ ledger: [JSON.parse(JSON.stringify(legacy))], nextId: 8 });
  const m = mergeBooks({ state: mine, savedAt: T.mon }, { state: theirs, savedAt: T.tue });
  check("the same old row from two devices is not doubled", m.state.ledger.length === 1, `got ${m.state.ledger.length} rows`);
}
{
  // Both devices independently handed out id 7 to different expenses.
  const mine = books({ ledger: [row({ id: 7, vendor: "Nike", amount: 400 })], nextId: 8 });
  const theirs = books({ ledger: [row({ id: 7, vendor: "UPS", amount: 60 })], nextId: 8 });
  const m = mergeBooks({ state: mine, savedAt: T.mon }, { state: theirs, savedAt: T.tue });
  check("two different rows that share an id both survive", m.state.ledger.length === 2, `got ${names(m.state.ledger)}`);
  check("the next id skips past the clash", m.state.nextId === 8, `nextId=${m.state.nextId}`);
}

section("Bank balances and weekly sales");
{
  const mine = books({
    cash: [{ date: "2026-11-01", balance: 5000 }, { date: "2026-11-08", balance: 5200 }],
    sales: [{ week: "2026-11-01", net: 900 }],
  });
  const theirs = books({
    cash: [{ date: "2026-11-01", balance: 4800 }],
    sales: [{ week: "2026-11-08", net: 1100 }],
  });
  const m = mergeBooks({ state: mine, savedAt: T.mon }, { state: theirs, savedAt: T.tue });
  check("one balance per date, no duplicates", m.state.cash.length === 2, `got ${names(m.state.cash)}`);
  check("the later-saved balance for a shared date wins",
    m.state.cash.find(c => c.date === "2026-11-01").balance === 4800);
  check("both weeks of sales survive", m.state.sales.length === 2, `got ${names(m.state.sales)}`);
}

section("Settings and repeat bills");
{
  const mine = books({ settings: { name: "Scot Shop", reserve: 1500 }, recurring: [{ uid: "r-1", name: "Rent", amount: 900, freq: "monthly" }] });
  const theirs = books({ settings: { name: "The Scot Shop", reserve: 2000 }, recurring: [{ uid: "r-2", name: "Insurance", amount: 120, freq: "monthly" }] });
  const m = mergeBooks({ state: mine, savedAt: T.mon }, { state: theirs, savedAt: T.thu });
  check("settings come from whichever was saved last", m.state.settings.reserve === 2000, `reserve=${m.state.settings.reserve}`);
  check("repeat bills from both sides survive", m.state.recurring.length === 2, `got ${names(m.state.recurring)}`);
}

section("Nothing to do");
{
  const same = books({ ledger: [row({ uid: "u-a", vendor: "Nike", touched: T.mon })] });
  const m = mergeBooks({ state: same, savedAt: T.mon }, { state: JSON.parse(JSON.stringify(same)), savedAt: T.mon });
  check("identical books report no change", m.changed === false, `added=${m.added} updated=${m.updated} removed=${m.removed}`);
  check("and stay one row", m.state.ledger.length === 1);
}

section("Old tombstones are cleaned up");
{
  const ancient = new Date(Date.now() - 400 * 86400000).toISOString();
  const mine = books({ deleted: { "u-old": ancient, "u-new": T.mon } });
  const m = mergeBooks({ state: mine, savedAt: T.mon }, { state: books(), savedAt: T.mon });
  check("a year-old marker is dropped", !m.state.deleted["u-old"]);
  check("a recent one is kept", !!m.state.deleted["u-new"]);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
