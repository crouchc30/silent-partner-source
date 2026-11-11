/* Point a Supabase project at a real email sender.
 *
 *   node tools/set-smtp.mjs <access-token> <project-ref> <sender-email> <app-password>
 *
 * Until this is done the free tier will not let the email templates be edited at all, so the
 * sign-up mail keeps carrying a link instead of the code the site now asks for.
 */
const [, , TOKEN, REF, EMAIL, RAWPASS] = process.argv;
if (!TOKEN || !REF || !EMAIL || !RAWPASS) {
  console.error("need: <access-token> <project-ref> <sender-email> <app-password>"); process.exit(1);
}
// Google prints app passwords in four groups of four. The spaces are for reading, not typing.
const PASS = RAWPASS.replace(/\s+/g, "");

const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/config/auth`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    smtp_admin_email: EMAIL,
    smtp_host: "smtp.gmail.com",
    smtp_port: "587",   // the API wants this as a string, not a number
    smtp_user: EMAIL,
    smtp_pass: PASS,
    smtp_sender_name: "Silent Partner",
    smtp_max_frequency: 1,          // seconds between messages; the old cap was 2 an HOUR
    rate_limit_email_sent: 60,      // per hour, well under Gmail's daily allowance
  }),
});
const out = await r.json();
if (!r.ok) { console.error("failed:", out.message || JSON.stringify(out)); process.exit(1); }

const c = await (await fetch(`https://api.supabase.com/v1/projects/${REF}/config/auth`, {
  headers: { Authorization: `Bearer ${TOKEN}` },
})).json();
const ok = (l, v) => console.log(`  ${v ? "ok  " : "FAIL"}  ${l}`);
console.log(`\n${REF}`);
ok(`mail goes out through ${c.smtp_host}`, c.smtp_host === "smtp.gmail.com");
ok(`from ${c.smtp_sender_name} <${c.smtp_admin_email}>`, c.smtp_admin_email === EMAIL);
ok(`${c.rate_limit_email_sent} an hour, up from 2`, Number(c.rate_limit_email_sent) > 2);
