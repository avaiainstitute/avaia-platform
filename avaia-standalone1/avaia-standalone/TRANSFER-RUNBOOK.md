# AVAIA — Transfer & Ownership Runbook

This is the complete, step‑by‑step guide to move AVAIA — code, database, hosting,
domain, and AI — into **Dorian's** own accounts so he can own and run it end to
end. Follow the phases **in order**. Each step says who does it:

- 🟢 **Dorian** (the new owner)
- 🔵 **Brent** (handing it over)

**Result when finished:** avaiainstitute.com runs entirely on Dorian's GitHub,
Supabase, Vercel, Anthropic, and Resend accounts, with all existing pilot data
(including Dorian's and Jamie's real conversations) intact. Brent no longer pays
for or hosts any part of it.

> **Time:** ~60–90 minutes of focused work, plus DNS propagation waits.
> **You do not need to be a developer.** Every step is a dashboard click or a
> copy‑paste command. Where a terminal is needed, it's called out clearly.

---

## What AVAIA is made of (the five accounts)

| Piece | What it does | Whose account (after transfer) |
|---|---|---|
| **GitHub** | Stores the code | 🟢 Dorian (new repo) |
| **Supabase** | Database + sign‑in (auth, conversations, referrals) | 🟢 Dorian (project **transferred**, data kept) |
| **Vercel** | Hosts/serves the website | 🟢 Dorian (new project) |
| **Anthropic** | The Claude AI that powers the Guide | 🟢 Dorian (new API key) |
| **Resend** | Sends the sign‑in code emails | 🟢 Dorian (new account) |
| **Cloudflare** | The avaiainstitute.com domain + DNS | 🟢 Already Dorian's — nothing to transfer |

**Important distinction up front:** a **claude.ai subscription** (Pro/Team) is
**NOT** the same as **Anthropic API access**. AVAIA calls the Claude **API**,
billed separately at **console.anthropic.com**. Dorian needs an API key with
billing there (Phase 3). Without it, the conversations will not run.

---

## Phase 0 — Dorian creates the accounts (🟢)

Create a free account for each of these (use the **same email** for all, to keep
it simple):

1. **GitHub** — https://github.com/signup
2. **Supabase** — https://supabase.com/dashboard (sign in with GitHub is fine)
3. **Vercel** — https://vercel.com/signup (sign in with GitHub — this links them)
4. **Anthropic Console** — https://console.anthropic.com
5. **Resend** — https://resend.com/signup

Cloudflare (the domain) is already Dorian's — no new account needed.

---

## Phase 1 — Move the code to Dorian's GitHub (🟢, with the zip from Brent)

The code is delivered as a zip that already contains the **full git history**.

1. 🟢 Unzip `avaia-standalone.zip` somewhere permanent (e.g. `Documents/avaia`).
2. 🟢 Create a **new, empty** GitHub repo: https://github.com/new
   - Name: `avaia` (or anything).
   - **Private** is recommended.
   - Do **not** add a README, .gitignore, or license (the zip already has them).
   - Click **Create repository** and copy the repo URL it shows
     (e.g. `https://github.com/dorian/avaia.git`).
3. 🟢 Open a terminal **inside the unzipped folder** and run (paste the URL from
   step 2):
   ```bash
   git remote add origin https://github.com/<dorian>/avaia.git
   git branch -M main
   git push -u origin main
   ```
   If it asks you to sign in, use a GitHub **Personal Access Token** as the
   password (GitHub → Settings → Developer settings → Personal access tokens →
   "Generate new token (classic)" → check `repo` → generate → copy → paste as the
   password).
4. 🟢 Refresh the GitHub repo page — you should see all the files and the commit
   history.

> **Windows note:** if you don't have git, install it from https://git-scm.com.
> The zip's folder already *is* a git repository — you only add the remote and
> push.

---

## Phase 2 — Transfer the Supabase project to Dorian (🔵 + 🟢)

This moves the **existing** database — keeping every user, conversation, and
referral. Because it's a transfer (not a rebuild), **the database URL and keys do
not change**, which makes the rest of the setup simpler.

1. 🟢 In Supabase, create a **new Organization**: Dashboard → your org dropdown
   (top‑left) → **New organization** → name it (e.g. "AVAIA") → Free plan is fine.
2. 🟢 Invite Brent as an **Owner** of that new org so he can push the project into
   it: Organization → **Team** → **Invite** → Brent's email → role **Owner**.
3. 🔵 Accept the invite (check email), then open the **AVAIA project**
   (ref `wcrlqkchcihzcoklrexi`) → **Project Settings** → **General** → scroll to
   **Transfer project** → choose Dorian's new organization → confirm.
4. 🟢 Once it lands in your org, remove Brent from the org (optional, later):
   Organization → Team → remove Brent.

> ✅ After transfer, the project's **API URL and keys stay the same**, so you do
> not need to change them anywhere. Billing for the project now goes to Dorian's
> org.
>
> If the Transfer button is greyed out, both orgs simply need to be on compatible
> plans (Free → Free works). Follow Supabase's on‑screen note.

**Get the keys you'll need for Vercel (Phase 5):** AVAIA project → **Project
Settings** → **API** (newer dashboards: URL under **Data API**, keys under **API
Keys**). Copy these three, keep them handy:
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon / publishable key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role / secret key** → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ secret — never
  share or put in the browser)

---

## Phase 3 — Create Dorian's Anthropic API key (🟢)

1. Go to https://console.anthropic.com → **Billing** → add a payment method and a
   little starting credit (e.g. $20). *(This is separate from any claude.ai
   subscription.)*
2. Go to **API Keys** → **Create Key** → name it "AVAIA" → **copy** the key
   (starts with `sk-ant-…`). You'll paste it into Vercel in Phase 5 as
   `ANTHROPIC_API_KEY`. Save it now — you can't see it again later.

---

## Phase 4 — Set up email sending with Resend (🟢)

AVAIA emails a **6‑digit sign‑in code** to each person. That send goes through
Resend, wired into Supabase.

> The transferred project *keeps Brent's existing email settings working* for a
> while, so sign‑in won't break the instant you transfer. But to fully cut Brent
> out, switch it to Dorian's own Resend using the domain **avaiainstitute.com**:

1. 🟢 In Resend → **Domains** → **Add Domain** → `avaiainstitute.com` → follow the
   DNS records it shows. Add those records in **Cloudflare** (DNS → Records →
   set each one **DNS only / grey cloud**). Wait for Resend to show "Verified."
2. 🟢 In Resend → **API Keys** → create one → copy it (starts with `re_`).
3. 🟢 In **Supabase** → **Authentication** → **Emails** (or **SMTP Settings**) →
   enable **Custom SMTP** and enter:
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: the `re_…` API key from step 2
   - Sender email: `noreply@avaiainstitute.com`  · Sender name: `AVAIA`
4. 🟢 **CRITICAL — the email must contain the CODE, not a link.** In Supabase →
   **Authentication → Emails → Templates**, open **Magic Link** *and* **Confirm
   signup**, and make each body contain **`{{ .Token }}`** and **not**
   `{{ .ConfirmationURL }}`. A known‑good body:
   ```html
   <h2>Your AVAIA sign-in code</h2>
   <p>Enter this code to sign in:</p>
   <p style="font-size:28px;font-weight:700;letter-spacing:6px">{{ .Token }}</p>
   <p style="color:#888">This code expires shortly. If you didn't request it, ignore this email.</p>
   ```
   Save each. *(If a template shows a link variable, the email will contain a link
   instead of a code and sign‑in will fail — this is the single most common
   mistake.)*

---

## Phase 5 — Deploy on Dorian's Vercel (🟢, one step needs 🔵)

1. 🔵 **Release the domain first** so Dorian's project can claim it: in Brent's
   Vercel → the **avaia** project → **Settings → Domains** → remove
   `avaiainstitute.com`, `www.avaiainstitute.com`, and `avaiainstitute.org`.
   *(Do this right before Phase 6; the live site keeps serving from Brent's
   project until then.)*
2. 🟢 In Vercel → **Add New… → Project** → **Import** the GitHub repo you pushed
   in Phase 1. (Authorize Vercel to see your GitHub if prompted.)
3. 🟢 Framework preset: **Next.js** (auto‑detected). **Root Directory: leave as
   `.` (the repo root).**
   > ⚠️ This is different from Brent's old setup, where the root directory was
   > `avaia`. In your standalone repo the app is already at the root.
4. 🟢 Expand **Environment Variables** and add these (from Phases 2 and 3):
   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key |
   | `ANTHROPIC_API_KEY` | Anthropic `sk-ant-…` key |
   | `NEXT_PUBLIC_AVAIA_TRACK_URL` | *(optional — leave blank; analytics)* |
5. 🟢 Click **Deploy**. When it finishes you'll get a `…vercel.app` URL. Open it —
   the site should load. **Test sign‑in on the vercel.app URL first** (you'll get
   a code by email) before moving the real domain over.

---

## Phase 6 — Point the domain at Dorian's project (🟢)

The domain lives in **Dorian's Cloudflare** already, so this is just re‑attaching.

1. 🟢 In Vercel → your project → **Settings → Domains** → **Add** →
   `avaiainstitute.com`. Vercel shows the DNS it wants.
2. 🟢 In **Cloudflare** → the avaiainstitute.com zone → **DNS → Records**, make
   sure:
   - `A` record, name `@`, value **`76.76.21.21`**, **Proxy status: DNS only
     (grey cloud)**. ⚠️ It must be grey, not orange — an orange/proxied cloud
     breaks Vercel's verification. *(This record is probably already there from
     Brent's setup — just confirm it's grey.)*
   - `CNAME` `www` → `cname.vercel-dns.com`, **DNS only**.
3. 🟢 Back in Vercel, also **Add** `www.avaiainstitute.com` (redirect to apex) and,
   if you want the .org, `avaiainstitute.org` (Vercel → set it to **Redirect** →
   `avaiainstitute.com`, 308). For .org, its Cloudflare zone needs an `A @` →
   `76.76.21.21`, DNS only, too.
4. 🟢 Wait for Vercel to show **Valid Configuration** (usually minutes, up to an
   hour). Then open https://avaiainstitute.com — it's now Dorian's.

---

## Phase 7 — Confirm Supabase auth URLs (🟢)

So sign‑in redirects land correctly:

1. Supabase → **Authentication** → **URL Configuration**:
   - **Site URL:** `https://avaiainstitute.com`
   - **Redirect URLs:** add `https://avaiainstitute.com/**` and your
     `https://<project>.vercel.app/**`.

*(If the domain and Site URL are unchanged from before, this is already correct —
just verify.)*

---

## Phase 8 — Final end‑to‑end check (🟢)

On **https://avaiainstitute.com**:

- [ ] Home / About page loads.
- [ ] **Sign in** → enter email → a **6‑digit code** arrives (not a link) → enter
      it → you're in.
- [ ] Start **The Journey** → the Guide replies (this proves the Anthropic key
      works).
- [ ] Say something with a virtue word → the table highlights it.
- [ ] Click **I'm ready to move forward** → it prepares a referral and advances.
- [ ] Open **Workbook** → your past journeys are there (the transferred pilot data
      should be visible when signed in as the account that created it).

If sign‑in emails don't arrive → re‑check Phase 4 (SMTP + `{{ .Token }}`
template). If the Guide errors → re‑check `ANTHROPIC_API_KEY` in Vercel and that
Anthropic billing is active.

---

## Phase 9 — Brent decommissions his side (🔵, after Phase 8 passes)

Once Dorian confirms everything works on avaiainstitute.com:

1. 🔵 Vercel → delete (or leave idle) the old **avaia** project.
2. 🔵 Resend → the ccrcoaching.com sender can stay (it's Brent's domain); just
   confirm AVAIA now sends via Dorian's Resend (Phase 4). No action needed if so.
3. 🔵 Supabase → already transferred; Brent has no remaining project.
4. 🔵 Anthropic → nothing to do; the app no longer uses Brent's key.
5. 🔵 The code stays in Brent's monorepo history but is no longer deployed
   anywhere; Dorian's GitHub repo is now the source of truth.

**After this, Dorian owns and pays for everything: GitHub (free), Supabase,
Vercel, Anthropic (per‑use), Resend.**

---

## Appendix A — Running it locally (optional, for development)

```bash
npm install
# create a file named .env.local with the 4 values (see .env.example)
npm run dev        # http://localhost:3000
npm run build      # production build check
npm run typecheck  # type check
```

`.env.local` (never commit this):
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=...
```

## Appendix B — Environment variables reference

| Variable | Where it's used | Secret? | Source |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | No | Supabase → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server | No | Supabase → API |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** | **Yes** | Supabase → API |
| `ANTHROPIC_API_KEY` | **Server only** | **Yes** | console.anthropic.com |
| `NEXT_PUBLIC_AVAIA_TRACK_URL` | Browser | No | Optional analytics; leave blank |

## Appendix C — How the AI behaves (where to change it)

All of the Guide's behavior — the voice standard, the IAP/CAT/InnerCompass
instruction sets, the guardrails, the referral logic, and the virtue‑table
prompting — lives in **`lib/engine/prompts.ts`**. The Claude model is set there
too (`AVAIA_MODEL`). Editing that file and pushing to GitHub redeploys via Vercel
automatically. The database structure is in **`supabase/schema.sql`** (already
applied to the live database — only needed if you ever build a second, empty
project).

## Appendix D — If you ever want a *fresh* database instead of the transfer

You chose to transfer the existing data. If a clean slate is ever wanted:
create a new Supabase project, open **SQL Editor**, paste the contents of
`supabase/schema.sql`, run it, then use that project's URL/keys. (You'd lose the
existing conversations.)
