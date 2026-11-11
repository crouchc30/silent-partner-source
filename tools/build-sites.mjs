/* Builds the two sites out of this one source.
 *
 *   node tools/build-sites.mjs
 *
 * sites/scotshop  -- the Scot Shop's own copy. Its wording stays as it is: the Sports Club
 *                    owns the shop, so "the Sports Club's check" is the true name for the
 *                    thing, and the categories are the ones from the October session.
 *
 * sites/general   -- the same site with the Scot Shop taken out of it, for any small business.
 *                    The year-end pages keep their shape, because "hold back what you need to
 *                    open again, then see what's left to pay out" is not a Scot Shop problem,
 *                    it is every seasonal business's problem. Only the names change.
 *
 * They are built rather than copied by hand so a fix lands in both. After this runs each
 * folder stands on its own: its own repository, its own address, its own database.
 */
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHARED = ["index.html", "reset.html", "app.js", "auth.js", "cloud.js", "merge.js",
                "styles.css", "guide.html", "guide.css", "guide.js", "_headers", "robots.txt"];

// What the general site calls the things the Scot Shop calls by their own names.
const GENERAL_WORDS = [
  ["End-of-year distribution: the Sports Club", "End-of-year payout: the owners"],
  ["End-of-year distribution: Sports Club", "End-of-year payout: owners"],
  ["End-of-year distribution: management", "End-of-year payout: managers"],
  ["The Sports Club owns the shop, so this isn't a donation, it's their share of the year.",
   "Whoever owns the business gets what is left at the end of the year. This works out what that is."],
  ["The Sports Club owns the shop, so the year-end check is its share of the year, not a gift.",
   "The owners get what is left at the end of the year, once the business has kept what it needs."],
  ["Sports Club check", "Year-end payout"],
  ["The Sports Club's check", "The owners' payout"],
  ["Sports Club's check", "owners' payout"],
  ["the Sports Club's", "the owners'"],
  ["There isn't a Sports Club check in these numbers yet.", "There isn't a payout in these numbers yet."],
  ["the Sports Club", "the owners"],
  ["Sports Club", "owners"],
  ["Management checks", "Manager payouts"],
  ["management checks", "manager payouts"],
  ["Gift to the Sports Club", "Year-end payout"],
  ["e.g. a year-end gift to the Sports Club, paying myself, a new oven",
   "e.g. paying myself properly, a year-end payout, a new oven"],
  ["The Scot Shop", "Your business"],
  ["the Scot Shop", "your business"],
  ["Scot Shop", "your business"],
];

// The Scot Shop's categories are hers. A general site should not arrive carrying them.
const GENERAL_CATS = `const DEFAULT_CATS = ["Stock and supplies", "Rent", "Utilities", "Wages", "Insurance",
  "Fees and licences", "Marketing", "Repairs", "Equipment", "Software", "Taxes", "Other",
  "End-of-year payout: owners", "End-of-year payout: managers"];`;


const PRIVACY = `## What is private, and what is not

Your books live in a Supabase database that only this site's accounts can open. That rule is
enforced by the database itself, not by the page, so editing the page in a browser gets nobody
in. Passwords are hashed by Supabase and cannot be read by anyone, including whoever runs this.
All traffic is over HTTPS, and every change is signed with a name and a time under **History**.

Being straight about the limit: Supabase, as the company hosting the database, could
technically read what is in it. An earlier version of this site encrypted everything with a
password that never left the browser, and could honestly say that nobody at all could read it.
That version could not offer a "forgot password" link, because the password *was* the key. You
cannot have both. This one chose the version a real shop can actually use.
`;

const SETUP = `## Running your own copy

1. Make a free project at [supabase.com](https://supabase.com).
2. Paste \`supabase/schema.sql\` from the source repository into its SQL Editor and run it.
3. Put that project's URL and its **publishable** key into \`config.js\`.
4. Serve this folder as a static site. There is nothing to build and nothing to install.

Set up custom SMTP in Supabase before letting strangers sign up. The built-in mail service is
capped at two messages an hour, so the third person to ask for a password reset gets nothing.
`;

const SCOTSHOP_README = `# Silent Partner — the Scot Shop

The back office, handled. Live at **https://scotshopsilentpartner.netlify.app**

Keeps track of the shop's money all year, so that "how much can we spend, or give away?" takes
a minute instead of a week. Built for ENT 1000 at Washington and Lee, Fall 2026, by Jillian
Gangaram, Caitlyn Crouch and Claudia Ramirez, out of interviews with the Scot Shop.

## What it does

- **Safe to spend today** — what is left after every bill it knows about and a cushion for
  surprises, with every line of the arithmetic shown
- **Can we afford it?** — checks one amount and pushes back, naming the bills at risk
- **The Sports Club check** — the end-of-year distribution. Holds back what the shop needs to
  open next season and the management checks, then shows what is left
- **Management checks** — splits the management pool evenly or by weighted shares
- **Expenses** — missing details, possible duplicates and large amounts are flagged for a
  second look before they count
- **Bills & sales** — bank balance, weekly sales, repeat bills
- **Weekly update** — a plain-language summary to copy. Nothing is ever sent for you
- **Pricing** — whether a product still makes money once you pay yourself
- **History** — every sign-in and every change, with a name against it, which nobody can edit
- **A walkthrough** — \`guide.html\`, 30 pages in plain English with a picture of every part

Everyone who uses it makes their own account, and everyone sees the same books from any device.
Two people can work at once without overwriting each other.

The owner makes every decision. The site organises, flags, and shows its working.

${PRIVACY}
${SETUP}
`;

const GENERAL_README = `# Silent Partner

The back office, handled. Live at **https://silentpartnerhq.netlify.app**

A free, private back office for a small business. It keeps track of the money all year, so that
"can we afford this?" takes a minute instead of an afternoon of spreadsheets.

Built for ENT 1000 at Washington and Lee, Fall 2026, by Jillian Gangaram, Caitlyn Crouch and
Claudia Ramirez, out of nine interviews across eight local businesses.

## What it does

- **Safe to spend today** — what is left after every bill it knows about and a cushion for
  surprises, with every line of the arithmetic shown
- **Can we afford it?** — checks one amount and pushes back, naming the bills at risk
- **Year-end payout** — holds back what the business needs to open again and the manager
  payouts, then shows what is left for the owners
- **Manager payouts** — splits a pool evenly or by weighted shares
- **Expenses** — missing details, possible duplicates and large amounts are flagged for a
  second look before they count
- **Bills & sales** — bank balance, weekly sales, repeat bills
- **Weekly update** — a plain-language summary to copy. Nothing is ever sent for you
- **Pricing** — whether a product still makes money once you pay yourself
- **History** — every sign-in and every change, with a name against it, which nobody can edit
- **A walkthrough** — \`guide.html\`, 30 pages in plain English with a picture of every part

Everyone who uses it makes their own account, and everyone sees the same books from any device.
Two people can work at once without overwriting each other.

Pages you do not need can be switched off under **Settings → Which pages you want**. Nothing is
deleted; switch one back on and what was in it is still there.

The owner makes every decision. The site organises, flags, and shows its working.

${PRIVACY}
${SETUP}
`;

const read  = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const write = (site, f, t) => {
  const out = path.join(ROOT, "sites", site, f);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, t);
};

function copyTree(site, rel) {
  const from = path.join(ROOT, rel);
  if (!fs.existsSync(from)) return;
  fs.cpSync(from, path.join(ROOT, "sites", site, rel), { recursive: true });
}

function build(site, { shopName, general, title, supabaseUrl, supabaseAnon }) {
  fs.rmSync(path.join(ROOT, "sites", site), { recursive: true, force: true });

  for (const f of SHARED) {
    let t = read(f);
    if (general) {
      if (f === "app.js") {
        const a = t.indexOf("const DEFAULT_CATS");
        const b = t.indexOf("];", a) + 2;
        t = t.slice(0, a) + GENERAL_CATS + t.slice(b);
      }
      for (const [from, to] of GENERAL_WORDS) t = t.split(from).join(to);
    }
    t = t.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
    if (!general && f.endsWith(".html")) {
      t = t.replace("<title>", '<meta name="robots" content="noindex, nofollow">\n  <title>');
    }
    write(site, f, t);
  }
  // One shop's books have no business being in search results: being findable there serves
  // nobody who actually uses it and invites people to go poking. The general site is the
  // opposite -- it is meant to be found.
  write(site, "robots.txt", general
    ? "# This site is meant to be found.\nUser-agent: *\nAllow: /\n"
    : "# One business's books. Shared by link, kept out of search results.\nUser-agent: *\nDisallow: /\n");


  // Each site is its own repository, so each needs its own README rather than one that
  // describes a source tree the people reading it will never see.
  write(site, "README.md", general ? GENERAL_README : SCOTSHOP_README);
  copyTree(site, "vendor");
  copyTree(site, "guide");

  // Each site talks to its OWN database. Two projects, so one business's books can never
  // appear in the other's site even if something above this line goes wrong.
  write(site, "config.js", read("config.js")
    .replace(/supabaseUrl:\s*"[^"]*"/,  `supabaseUrl:  ${JSON.stringify(supabaseUrl)}`)
    .replace(/supabaseAnon:\s*"[^"]*"/, `supabaseAnon: ${JSON.stringify(supabaseAnon)}`)
    .replace(/shopName: "[^"]*"/, `shopName: ${JSON.stringify(shopName)}`));

  // No catch-all redirect. This is three real pages, not a single-page app: sending every
  // unknown path to index.html with a 200 would hide a file that failed to deploy behind a
  // page that looks like it worked.
  write(site, "netlify.toml", `[build]\n  publish = "."\n`);
  console.log("built sites/" + site);
}

build("scotshop", {
  shopName: "The Scot Shop",
  general: false,
  title: "Silent Partner \u2014 the Scot Shop",
  supabaseUrl:  "https://lanqmvwdmqlgnyarnohz.supabase.co",
  supabaseAnon: "sb_publishable_0G8AoOfhw-de8KmVgfcWsQ_XUFhGSbG",
});

build("general", {
  shopName: "My Business",
  general: true,
  title: "Silent Partner \u2014 the back office, handled",
  supabaseUrl:  "https://ryqbuonpqjrihbeawnsf.supabase.co",
  supabaseAnon: "sb_publishable_35tn2ziNS8rz6cAIAQxx6A_cwl3rAgE",
});

// Each site is photographed AFTER it is written, into its own guide/img. The two use
// different words for the same pages, so sharing one set of pictures would put the Scot
// Shop in the general site's walkthrough. Doing it here means the order cannot be got wrong.
if (!process.argv.includes("--no-shots")) {
  for (const site of ["scotshop", "general"]) {
    const r = spawnSync(process.execPath, [path.join(ROOT, "tools", "guide-shots.mjs"),
      path.join(ROOT, "sites", site)], { stdio: "inherit" });
    if (r.status !== 0) { console.error(`\nphotographing sites/${site} failed`); process.exit(1); }
  }
}
