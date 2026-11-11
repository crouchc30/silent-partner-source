# The two email templates, so the mail carries a code instead of a link

Do this in **both** Supabase projects. Dashboard → **Authentication** → **Emails**
(older dashboards: *Email Templates*).

The only thing that actually matters is that the body uses `{{ .Token }}` — the code — and
no longer uses `{{ .ConfirmationURL }}`. The wording below is just wording.

---

## 1. "Confirm signup"

**Subject**

```
Your Silent Partner code
```

**Message body** — switch the editor to HTML and replace everything with this:

```html
<h2>Confirming your email</h2>
<p>Here is the code to finish setting up your Silent Partner account:</p>
<p style="font-size:32px;letter-spacing:8px;font-weight:700;font-family:monospace;margin:24px 0">{{ .Token }}</p>
<p>Type it into the box on the site and press <strong>Confirm</strong>.</p>
<p style="color:#667085;font-size:13px">The code works for one hour. If you didn't ask for
this, you can ignore it — nothing has been created that anyone can use.</p>
```

---

## 2. "Reset password"

**Subject**

```
Your Silent Partner reset code
```

**Message body**

```html
<h2>Setting a new password</h2>
<p>Here is the code to set a new password for your Silent Partner account:</p>
<p style="font-size:32px;letter-spacing:8px;font-weight:700;font-family:monospace;margin:24px 0">{{ .Token }}</p>
<p>Type it into the box on the site, then pick your new password.</p>
<p style="color:#667085;font-size:13px">The code works for one hour. If you didn't ask for
this, you can ignore it — your password has not changed and nobody has been let in.</p>
```

---

## 3. How many digits

**Authentication → Sign In / Providers → Email → Email OTP Length.**

Supabase allows **6 to 10**. Four is not possible, whatever the dashboard hints at. Newer
projects are set to 8 out of the box; **6 is the shortest allowed** and the easiest to read
over the phone.

The site does not care which you pick. It accepts whatever arrives and lets the server be the
judge, so changing this later breaks nothing.
