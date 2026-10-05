# Separating the Pink Shoelace Foundation from AVAIA

Written 2026-10-05. Founder directive: the Pink Shoelace Foundation and AVAIA are separate. Different
table prefixes, folders, route names and branding do not make them separate. **Status today: NOT FULLY
SEPARATE.** This pass stopped every cross-organization data flow in code and prepared the rest; what is
left needs accounts only the owner can create.

## 1. What real separation requires, item by item

A = must be separate. B = should be separate. C = can safely be shared. D = not applicable.

| Item | Verdict | Why |
|---|---|---|
| Code repository | **B** | The Foundation's backend, admin and cron sit in AVAIA's repository. Anyone or any AI session that can push to AVAIA can change the Foundation. The public site already has its own repository. |
| Vercel (hosting) project | **A** | One deploy builds both. A failed AVAIA build blocks the Foundation's forms, and a Foundation change can break AVAIA. The Foundation's secrets sit in AVAIA's project settings. |
| Cloudflare | **C** now, **B** when a second person needs the Foundation's DNS | Both domains appear to be in one Cloudflare account. Only the owner uses it today. |
| Supabase (database) project | **A** | The Foundation's records are grief-related contact details held with a service key that also opens every AVAIA Journey, Workbook, Guide and member record. "No browser policy" is not isolation from that key. Also needed for independent backups and for the Foundation to be able to leave. |
| Authentication | **A** | The Foundation's admin must not be an AVAIA account, and an AVAIA admin must not open the Foundation. |
| Admin system and credentials | **A** | Follows from authentication. |
| Environment variables and secrets | **A** | Follows from Vercel and Supabase. |
| Email domain and sender | **A** | Foundation email must come from the Foundation (`thepinkshoelace.org`), not AVAIA's domain. |
| Email account | **C**, with a **separate domain-restricted key (A)** | A Resend key limited to the Foundation's domain gives credential separation without a second account or bill. |
| Scheduled jobs | **A** | They live in the Foundation's own Vercel project once it exists. |
| Storage | **D** | The Foundation stores no files. |
| Logging | **B** | Run logs, email failures and health results follow the database. |
| Analytics | **D** | The Foundation's site has none. |
| Health / system checks | **B** | The Foundation gets its own small set; AVAIA's suite stops watching the Foundation. |
| Backups | **A** | Follows from a separate database. Note: the current project shows no backups (see 5). |
| API keys | **A** for Resend; **B** for the Anthropic key | The Foundation needs no AI unless the owner keeps the optional donor research. |
| External services | **D** | Stripe and AVAIA's others are not used by the Foundation. Legacy's payment processor is Legacy's. |

## 2. The architectures

**Option A, shared infrastructure with enforced isolation.** Keep one Supabase project and one Vercel
project; separate Postgres schemas, a restricted database role, and strict code rules.
- Shared: project, owner account, service key (or a second key with the same owner), backups, auth pool, deployments.
- Data isolation: partial (schema grants). Credential isolation: no (the project holds both). Deployment isolation: none. Administrative isolation: none (same dashboards). Accidental cross-access: low in code, high operationally. One deploy can break the other: yes. Maintenance: lowest. Migration difficulty: lowest. Recurring cost: none added. Flexibility: poor (the Foundation can never leave). **Organizational separation technically enforceable: no.** Anyone with the project dashboard sees both.

**Option B, the Foundation becomes its own project.** New repository, new Vercel project, new Supabase
project, its own sending domain and key. The public site stays where it is, and its forms post to the
Foundation's own host.
- Shared: nothing technical except the owner's own logins and (for now) the Cloudflare account and a Resend account.
- Data, credential, deployment, administrative isolation: full. Accidental cross-access: none by construction (no shared key exists). One deploy breaking the other: no. Maintenance: more (two small things to keep up). Migration difficulty: moderate (the code is already behind one boundary: `lib/pink`, `app/api/pink`, `app/pink-admin`; the data is almost all empty). Cost: a second Supabase project and Vercel project (see 4). Flexibility: high (can move to Legacy, a board or a contractor intact). **Technically enforceable: yes.**

**Other legitimate architectures.** (1) The Foundation's backend as Cloudflare functions beside its static site: no new host, but it means rewriting the routes and rebuilding the admin, which is a rebuild. (2) A separate Supabase *organization* for the Foundation, with Option B inside it: the cleanest ownership line, and it keeps billing and member lists apart.

**Recommendation: Option B**, with the new Supabase project in its own Supabase organization if the owner can. It is the smallest architecture in which AVAIA cannot hold the Foundation's credentials or data and the Foundation cannot depend on an AVAIA service. Option A was rejected because it cannot be made to satisfy the directive. No item in section 1 is separated merely for tidiness: each A or B has a stated boundary it creates.

## 3. Extraction manifest (reuse, do not rebuild)

**Moves to the new repository, unchanged except imports:**
`lib/pink/*` (classify, cors, abuse, emails, mail, linking, ops), `app/api/pink/contact`, `app/api/pink/participation`,
`app/api/cron/pink-daily-summary`, `app/pink-admin/*`, and the Foundation branches of
`lib/admin-views/{Inquiries,Opportunities,Notes,Content}View.tsx` (the AVAIA branches are dropped).

**Replaced, because they are AVAIA's:** `lib/supabase/{admin,server,middleware}` (point at the Foundation's project),
`lib/resend` (`sendEmail`, `escapeHtml`), `lib/ops/cron-auth`, `cron-runs`, `needs-dorian-core` (types),
the `detectCrisis` function from `lib/engine/anthropic` (copied, not imported; it only classifies text),
the Pink checks in `system-checks`, the self-tests in `pink-separation-selftests`.

**Schema in the new Supabase project:** the 12 `pink_*` tables (empty except research output), plus
Foundation-owned versions of `founder_notes` and the content table, `cron_runs`, `system_check_results`,
`email_send_failures`, and a small admin table. (All 12 `pink_*` tables, with their columns, are in
migrations 0063, 0071, 0072, 0106, 0119.)

**Environment variables in the new Vercel project:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` (the Foundation's), `CRON_SECRET`, `PINK_FROM_EMAIL`, `PINK_RESEND_API_KEY`,
`PINK_NOTIFICATION_EMAIL`, optional `PINK_SITE_ORIGIN`, `PINK_PARTNERSHIP_FOLLOWUP_DAYS`, `PINK_DONOR_FOLLOWUP_DAYS`.
No AVAIA secret is copied.

**Routes change:** the site's two forms post to the Foundation's own host (for example
`https://app.thepinkshoelace.org/api/pink/contact`), not `www.avaiainstitute.com`. The old AVAIA routes are removed
after the new ones are proven, so AVAIA no longer hosts the Foundation.

**What stays in AVAIA:** nothing of the Foundation's. AVAIA drops the Pink System Checks, the separation check, and
the `pink_*` rows are left frozen (see `DATA.md`) until the owner approves removing them.

**Tests that follow the code:** the boundary self-test, email identity, spam protection, intake end to end,
admin sign-in, daily summary, and a build guard that fails if the Foundation's repository imports anything AVAIA.

## 4. Cost note (confirm on your accounts)

I could not read the Supabase plan from the API (the token is project-scoped). The current project shows no
backups, which usually means the free plan. Free Supabase projects pause after about a week without activity,
and a paused database would make the public forms fail, so a public intake form should not sit on a free
project. A Pro Supabase plan is about $25 a month per organization (extra projects add compute). Vercel's free
tier is for personal, non-commercial use; whether a charity program qualifies is a question for Vercel's terms.
Because the Foundation's money belongs to Legacy's fund, whether the Foundation (rather than the owner) may pay
for infrastructure is a question for Legacy. **These are owner decisions, not mine.**

## 5. Backups

The Supabase API reports no backup and no point-in-time recovery for the current project. That is a risk to
AVAIA's own data as well, not only a separation point. Nothing was changed.

## 6. The owner's steps (exact), in order

Creating paid resources, domains, DNS records and secrets is yours to do or to explicitly authorize. If you
would rather I click through these in the Browser pane while you are signed in, say so; I will not create a
paid resource or enter a secret without your clear go-ahead.

**Step 1. A new GitHub repository.** Go to github.com while signed in as `avaiainstitute`. Click the green
**New** button (or the **+** at the top right, then **New repository**). Repository name:
`pink-shoelace-foundation-app`. Choose **Private**. Leave "Add a README," ".gitignore" and "license" **unchecked**.
Click **Create repository**. Tell me the repository address (it looks like
`https://github.com/avaiainstitute/pink-shoelace-foundation-app`). Nothing else is needed from you for this
step; I push the code from this computer.

**Step 2. A new Supabase project.** Go to supabase.com/dashboard. Optional but recommended: at the top left click
your organization name, then **New organization**, name it `The Pink Shoelace Foundation`, choose the plan you decide
in section 4. Inside that organization click **New project**. Name: `pink-shoelace-foundation`. Database password:
click **Generate a password**, then copy it into your password manager (I do not need it). Region: **East US (Ohio)**.
Click **Create new project** and wait until the status says healthy. Then open **Project Settings** (gear icon) →
**General** and copy the **Project ID** (a 20-letter code). Tell me the Project ID. Do **not** paste the keys into the chat.

**Step 3. Create the Foundation's admin sign-in.** In that project click **Authentication** → **Users** → **Add user**
→ **Create new user**. Enter the Foundation email you want to sign in with and a password you choose. Leave
"Auto Confirm User" **on**. Click **Create user**. Tell me the email address you used.

**Step 4. A new Vercel project.** Go to vercel.com/dashboard. Click **Add New…** → **Project**. Find
`avaiainstitute/pink-shoelace-foundation-app` and click **Import**. Project name: `pink-shoelace-foundation`. Framework:
Next.js (it is detected). Do not change anything else. Before clicking **Deploy**, open **Environment Variables**
and add the variables listed in section 3. Where each value comes from:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`: in the new Supabase project,
  **Project Settings** → **API**. The URL is "Project URL"; the anon key is "anon public"; the service key is "service_role"
  (click Reveal). Paste each straight into Vercel.
- `CRON_SECRET`: any long random text; I will give you one to paste.
- `PINK_NOTIFICATION_EMAIL`: the address that should receive the Foundation's notices.
- `PINK_FROM_EMAIL` and `PINK_RESEND_API_KEY`: from Step 5.
Click **Deploy**.

**Step 5. The Foundation's own sending address.** Go to resend.com → **Domains** → **Add Domain**. Domain:
`thepinkshoelace.org`; region as offered. Resend shows a table of DNS records. In a second tab open Cloudflare →
the `thepinkshoelace.org` site → **DNS** → **Records** → **Add record**, and copy each Resend record exactly (Type, Name,
Value; set Proxy status to **DNS only** for each). **Do not touch the existing MX records on the main domain** (they
carry the Foundation's Google email); Resend's mail records are on a `send` subdomain. Back in Resend click
**Verify DNS Records** and wait for **Verified**. Then **API Keys** → **Create API Key**: name `pink-shoelace`, permission
**Sending access**, domain `thepinkshoelace.org`. Copy the key (it is shown once) and paste it into Vercel as
`PINK_RESEND_API_KEY`. Set `PINK_FROM_EMAIL` in Vercel to the address you want mail to come from, for example
`hello@thepinkshoelace.org`.

**Step 6. The Foundation's web address for its forms.** In the new Vercel project open **Settings** → **Domains** →
add `app.thepinkshoelace.org`. Vercel shows a record to create. In Cloudflare → `thepinkshoelace.org` → **DNS** → **Add record**:
Type **CNAME**, Name `app`, Target the value Vercel shows, Proxy status **DNS only**. Back in Vercel click **Refresh** until it is valid.

**Step 7. Tell me when Steps 1–6 are done.** I then: load the schema into the new database, move and adapt the code,
update the two site forms to the new address, run the tests, switch over, and remove the Foundation from AVAIA.

## 7. The thirteen questions, as of today

1. Can AVAIA access Foundation participant data? **Yes, technically** (the same service key and project). No AVAIA code reads it (guard + self-test).
2. Can the Foundation access AVAIA participant data? **Yes, technically.** The Foundation's files read none (guard rule B).
3. Can AVAIA write Foundation operational records? **Technically yes**; no AVAIA code does.
4. Can the Foundation write AVAIA operational records? **Technically yes**; its code writes only shared logging tables and the shared notes/content tables.
5. Can an AVAIA deployment break the Foundation? **Yes.**
6. Can a Foundation deployment break AVAIA? **Yes.**
7. Shared database credentials? **Yes.**
8. Shared admin credentials? **Yes** (one admin account).
9. Shared email identity? **Partly**: display name is the Foundation's; address and account are AVAIA's until Step 5.
10. Shared environment secrets? **Yes.**
11. Automations crossing the line? **No longer.** Cut on 2026-10-05.
12. Independent backups? **No.**
13. Still shared: repository, hosting, database, secrets, admin login, email sender, jobs, health checks, backups, Cloudflare account.

**NOT FULLY SEPARATE.**
