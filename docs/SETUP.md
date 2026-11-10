# What I need from you to finish

Two free accounts, about ten minutes. Everything else is already written or in progress.

---

## 1. Supabase — the accounts and the shared books (~6 min)

1. Go to **https://supabase.com** → **Start your project** → sign in with GitHub.
2. **New project.** Name it `silent-partner`. Pick a strong database password and save it
   somewhere — you won't need it for the site, but you'll want it later.
   Region: **East US (North Virginia)**. Free plan.
3. Wait for it to finish building (~2 min).
4. Left sidebar → **SQL Editor** → **New query**. Open `supabase/schema.sql` from this folder,
   paste the whole thing in, press **Run**. It should say *Success. No rows returned*.
5. Left sidebar → **Project Settings** (gear) → **API**. Copy these two and send them to me:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **anon public** key — a long string starting `eyJ...`

   > Copy the one labelled **anon public**, not **service_role**. The anon key is designed to
   > sit in a public web page. The service_role key must never leave that settings screen.

6. Left sidebar → **Authentication** → **Providers** → **Email**: make sure it's enabled.
   For the first real use, leave **Confirm email** ON — that's what proves Mollie typed her
   own address correctly, and it's what makes the password-reset mail work.

**You will need to do this twice** — one project for the Scot Shop site, one for the general
Silent Partner site — because they must not share books. Name the second one
`silent-partner-general`.

---

## 2. Netlify — the two public addresses (~4 min)

1. Go to **https://netlify.com** → **Sign up** → **GitHub**.
2. You don't need to do anything else yet. Once I've pushed the two repos, I'll give you the
   exact clicks to connect each one, or you can authorize me and I'll run it from here.

The addresses you asked for:
- `scotshopsilentpartner.netlify.app`
- `silentpartner.netlify.app`

I'll check both names are free as soon as the repos are up. If `silentpartner` is taken,
the near options are `silentpartner-app`, `silentpartnerhq`, or a real domain
(`silentpartner.com`-style, about $12/year) which would look better for marketing anyway.

---

## 3. What changes about privacy, so you can say it accurately

The current site's promise is that nothing is ever uploaded, because the books are encrypted
with a password that never leaves the browser.

Accounts with email password reset cannot work that way. If Mollie can reset her password by
email and still see her books afterwards, then her password cannot be what the books are
encrypted with — the server has to be able to read them. That's not a shortcut; it's the
trade, and every product with a "forgot password" link has made it.

**What is true of the new sites:**
- The books live in a Supabase database, in a project only you control.
- Only signed-in members of that business can read them — enforced by the database itself
  (`supabase/schema.sql`), not by the browser, so editing the page source gets nobody in.
- Passwords are hashed by Supabase and are not readable by anyone, including you.
- Traffic is HTTPS.
- Supabase, as the host, *could* technically read the data. Your old site could say no one
  could. That sentence has to come out of the README, the walkthrough, and the pitch.

**What to say in the pitch instead:** *"Her books are hers — a private database only her
accounts can open, and every change is signed with a name and a time."*

That's honest, and the History tab makes it a stronger claim than before, not a weaker one.
