/* Put the code templates into a Supabase project, from here rather than by hand.
 *
 *   node tools/set-email-templates.mjs <access-token> <project-ref>
 *
 * The dashboard will not let you type into some of these templates, and there are four of
 * them across two projects, which is four chances to paste the wrong one into the wrong box.
 */
const [, , TOKEN, REF] = process.argv;
if (!TOKEN || !REF) { console.error("need: <access-token> <project-ref>"); process.exit(1); }

const code = (heading, line, after, reassure) => `<h2>${heading}</h2>
<p>${line}</p>
<p style="font-size:32px;letter-spacing:8px;font-weight:700;font-family:ui-monospace,Menlo,monospace;margin:24px 0;color:#1d3557">{{ .Token }}</p>
<p>${after}</p>
<p style="color:#667085;font-size:13px;margin-top:28px">This code works for one hour. If you didn't ask for it, you can ignore this email &mdash; ${reassure}</p>
<p style="color:#667085;font-size:13px">&mdash; Silent Partner</p>`;

const body = {
  // Six is the shortest Supabase allows. New projects arrive set to eight, which is a lot of
  // digits to read off a phone to somebody standing at a till.
  mailer_otp_length: 6,

  mailer_subjects_confirmation: "Your Silent Partner code",
  mailer_templates_confirmation_content: code(
    "Confirming your email",
    "Here is the code to finish setting up your Silent Partner account:",
    "Type it into the box on the site and press <strong>Confirm</strong>.",
    "no account has been made that anybody can use."),

  mailer_subjects_recovery: "Your Silent Partner reset code",
  mailer_templates_recovery_content: code(
    "Setting a new password",
    "Here is the code to set a new password for your Silent Partner account:",
    "Type it into the box on the site, then pick your new password.",
    "your password has not changed and nobody has been let in."),

  // The sign-in-code template, so a magic link never arrives instead of a code.
  mailer_subjects_magic_link: "Your Silent Partner sign-in code",
  mailer_templates_magic_link_content: code(
    "Signing in",
    "Here is your code to sign in to Silent Partner:",
    "Type it into the box on the site.",
    "nobody has been signed in."),
};

const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/config/auth`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const out = await r.json();
if (!r.ok) { console.error("failed:", out.message || JSON.stringify(out)); process.exit(1); }

// Read it back. A 200 from a settings API is not the same as the setting having changed.
const check = await (await fetch(`https://api.supabase.com/v1/projects/${REF}/config/auth`, {
  headers: { Authorization: `Bearer ${TOKEN}` },
})).json();

const ok = (label, cond) => console.log(`  ${cond ? "ok  " : "FAIL"}  ${label}`);
console.log(`\n${REF}`);
ok("codes are 6 digits", check.mailer_otp_length === 6);
ok("the sign-up email carries a code, not a link",
   String(check.mailer_templates_confirmation_content).includes("{{ .Token }}") &&
   !String(check.mailer_templates_confirmation_content).includes("ConfirmationURL"));
ok("the reset email carries a code, not a link",
   String(check.mailer_templates_recovery_content).includes("{{ .Token }}") &&
   !String(check.mailer_templates_recovery_content).includes("ConfirmationURL"));
ok("the sign-in email carries a code, not a link",
   String(check.mailer_templates_magic_link_content).includes("{{ .Token }}") &&
   !String(check.mailer_templates_magic_link_content).includes("ConfirmationURL"));
if (!check.smtp_host) {
  console.log(`\n  note: still on Supabase's own mail, ${check.rate_limit_email_sent} an hour.`);
}
