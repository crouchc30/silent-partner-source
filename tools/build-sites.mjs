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
