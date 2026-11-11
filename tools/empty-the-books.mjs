/* Leave a project with nothing in it: no books, no members, no history, no accounts.
 *
 *   node tools/empty-the-books.mjs <access-token> <project-ref>
 *
 * Run before handing a link to anybody. Everything in these sites is supposed to be a figure
 * somebody typed in, and a leftover test row is the one thing that could make that untrue.
 *
 * The accounts matter as much as the rows: joining picks the OLDEST business, so an account
 * left behind from testing could end up owning the books the real people then sign in to.
 */
const [, , TOKEN, REF] = process.argv;
if (!TOKEN || !REF) { console.error("need: <access-token> <project-ref>"); process.exit(1); }

const api = async (path, init = {}) => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}${path}`, {
    ...init, headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const t = await r.text();
  let j = null; try { j = t ? JSON.parse(t) : null; } catch { j = t; }
  if (!r.ok) throw new Error(`${path}: ${j?.message || t}`);
  return j;
};

const sql = q => api("/database/query", { method: "POST", body: JSON.stringify({ query: q }) });

console.log(`\n${REF}`);

// The rows.
await sql(`delete from history; delete from books; delete from members; delete from businesses;`);
const counts = await sql(`select
  (select count(*) from businesses)::int as businesses,
  (select count(*) from members)::int    as members,
  (select count(*) from books)::int      as books,
  (select count(*) from history)::int    as history;`);
const c = counts[0];
const empty = c.businesses === 0 && c.members === 0 && c.books === 0 && c.history === 0;
console.log(`  ${empty ? "ok  " : "FAIL"}  the books are empty  (${JSON.stringify(c)})`);

// The accounts. auth.users is not reachable over the data API, which is the point of it,
// but it is reachable here.
const users = await sql(`select id, email from auth.users;`);
if (!users.length) {
  console.log("  ok    no accounts left");
} else {
  for (const u of users) {
    await sql(`delete from auth.users where id = '${u.id}';`);
    console.log(`        removed ${u.email}`);
  }
  const left = await sql(`select count(*)::int as n from auth.users;`);
  console.log(`  ${left[0].n === 0 ? "ok  " : "FAIL"}  no accounts left  (${left[0].n})`);
}
