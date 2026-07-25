# AVAIA

An operating system for guided conversations — a web platform that renders the
AVAIA institution and is built on a single, typed model of it.

Authored by [friend] in his own voice. This app is the platform implementation.

## What's here

- **`institution/source/`** — the 17 source specification documents, preserved
  verbatim. These are the canonical intent; the app is built from them.
- **`lib/institution.ts`** — the whole institution encoded as one typed source
  of truth: the three layers, the core conversation flow, roles & seats,
  operating systems, engines, the Workbook, programs, and organization
  configuration.
- **`lib/virtues.ts`** — the Chemistry of Virtue: 100 virtues in 10 families,
  transcribed from the institutional artwork (symbols/names/families only).
- **`app/`** — the Next.js 14 (App Router) platform.

## Design boundary — "do not invent"

Several source documents reference institutional content that has **not yet
been provided** (the GIVE Method, the Constitution text, virtue definitions,
Secondary Loss categories). Per the author's own instruction, this platform
does **not fabricate** that content. Instead those places are marked
`AWAITING_SOURCE` in the model and shown as visible "awaiting source material"
notes in the UI. When the author supplies the material, we fill it in.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit
npm run build
```

## Deploy — its own Vercel project at avaiainstitute.com

Avaia is a **standalone Next.js app**, deployed as its own Vercel project at
`avaiainstitute.com` (with `.org` redirecting to it). It serves at the domain
root — no basePath, not a static export — so the login + Workbook + Claude
conversation engine can be added as real server routes on the same project,
backed by your Supabase.

**One-time Vercel setup**
1. Vercel → **Add New → Project** → import this repo.
2. Set **Root Directory = `avaia`** (this is a monorepo; the CCR platform lives
   in `platform/`). Framework preset: **Next.js**.
3. **Domains** → add `avaiainstitute.com` and `avaiainstitute.org`; set `.com`
   as primary so `.org` redirects to it. Point each domain's DNS at Vercel
   (A/ALIAS to Vercel, or the `www` CNAME Vercel shows).
4. **Environment variables** (add as needed):
   - `NEXT_PUBLIC_AVAIA_TRACK_URL` — the Google Apps Script `/exec` URL for
     anonymous usage logging (optional; tracker is inert without it).
   - Supabase + Anthropic keys are added later, when the conversation engine
     and accounts are built.

After that, every push deploys automatically. Locally: `npm run dev`.

## Roadmap (built on this same model)

1. **Reference platform** (this) — the institution, browsable. ✅
2. **Live conversation** — Guide/Host sessions for IAP → CAT → InnerCompass,
   with the Referral Engine carrying structured state between them.
3. **Workbook** — persistent records per Host (continuity over time).
4. **Report Engine** — one conversation, multiple report outputs.
5. **Organization Configuration** — real per-org branding/roles/permissions.
