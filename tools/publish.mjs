/* Push each built site to its own repository, and deploy it.
 *
 *   node tools/publish.mjs            # both
 *   node tools/publish.mjs scotshop   # one
 *
 * Each site is a repository of its own rather than a folder inside this one, because each is
 * handed to different people: the Scot Shop's copy is one shop's books, the general one is
 * the thing being shown to strangers. A commit here is one deploy there.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITES = {
  scotshop: { repo: "scotshop-silent-partner", netlify: "bb0d8bf1-7146-4523-bc2d-c4a2be552903", url: "https://scotshopsilentpartner.netlify.app" },
  general:  { repo: "silentpartner",           netlify: "99c0c410-505d-448c-870a-8be242bc3b2d", url: "https://silentpartnerhq.netlify.app" },
};

const run = (cmd, args, cwd) => {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")}\n${r.stdout}${r.stderr}`);
  return (r.stdout || "").trim();
};

const message = process.env.SP_MSG || "Accounts, a shared set of books, and a history of who changed what";
const want = process.argv[2] ? [process.argv[2]] : Object.keys(SITES);

for (const site of want) {
  const { repo, netlify, url } = SITES[site];
  const dir = path.join(ROOT, "sites", site);
  console.log(`\n=== ${site} -> github.com/crouchc30/${repo}`);

  // The built folder is not a repository until the first run.
  if (!fs.existsSync(path.join(dir, ".git"))) {
    run("git", ["init", "-q", "-b", "main"], dir);
    run("git", ["remote", "add", "origin", `https://github.com/crouchc30/${repo}.git`], dir);
  }
  fs.writeFileSync(path.join(dir, ".gitignore"), "node_modules/\n.netlify/\n.DS_Store\n");

  run("git", ["add", "-A"], dir);
  const staged = run("git", ["status", "--porcelain"], dir);
  if (staged) {
    run("git", ["commit", "-q", "-m", message,
      "-m", "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"], dir);
    console.log("  committed");
  } else {
    console.log("  nothing changed");
  }
  // --force-with-lease refuses when it has never seen the remote, which is every run after
  // the first in a fresh clone of this source. Fetch so it has something to compare against.
  spawnSync("git", ["fetch", "-q", "origin", "main"], { cwd: dir });
  run("git", ["push", "-u", "origin", "main", "--force-with-lease"], dir);
  console.log("  pushed");

  const nf = path.join(ROOT, "node_modules", ".bin", "netlify");
  const d = spawnSync(nf, ["deploy", "--prod", "--dir", ".", "--site", netlify], { cwd: dir, encoding: "utf8" });
  if (d.status !== 0) throw new Error(d.stdout + d.stderr);
  console.log(`  deployed -> ${url}`);
}
console.log("\ndone");
