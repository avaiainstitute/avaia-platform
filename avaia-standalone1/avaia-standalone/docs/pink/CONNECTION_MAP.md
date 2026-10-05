# Every connection between the Pink Shoelace Foundation and AVAIA

Mapped 2026-10-05, before and after the first separation pass. "Cut" means stopped in code on this
date. "Remains" means still shared and listed in `SEPARATION.md` with what is required to end it.

## Data crossings (a record moving, or being read, across the line)

| # | Connection | Direction | State |
|---|---|---|---|
| D1 | Weekly AI "partnership" research searched for BOTH organizations in one prompt and wrote AVAIA business development (relevance `avaia` / `both`) into `pink_partnership_prospects` | AVAIA writes Pink | **Cut.** The research cannot run (`STOPPED_VERTICALS`). The 15 existing rows are preserved. |
| D2 | AVAIA's admin Opportunities page listed Pink's partnership prospects (`relevance` avaia/both) | AVAIA reads Pink | **Cut.** AVAIA's page lists only AVAIA's own tables. |
| D3 | AVAIA's Founder Digest read `pink_partnership_prospects` (avaia/both) into AVAIA's daily email | AVAIA reads Pink | **Cut.** |
| D4 | AVAIA's "What Needs Dorian" counted Pink partnership prospects | AVAIA reads Pink | **Cut.** |
| D5 | Weekly AI "donor" research wrote into `pink_donor_prospects` from AVAIA's scheduled job | AVAIA writes Pink | **Cut from the schedule.** Pink's admin can still run it by hand (Pink-only prompt). |
| D6 | Weekly AI "speaking" research searched for both organizations and wrote Pink-relevant rows into `avaia_speaking_opportunities` | Pink data in AVAIA's table | **Cut.** The prompt is now AVAIA-only. The 4 existing rows tagged `both` are preserved. |
| D7 | `lib/ops/pink-avaia-connection.ts` compared Foundation submitters' emails with AVAIA accounts (never called) | Pink read against AVAIA's accounts | **Deleted.** It was unused. |
| D8 | Foundation notes and content plans are stored in AVAIA-named tables (`founder_notes`, `avaia_content_items`) | Pink data in AVAIA's tables | **Remains** (0 rows today). Ends at extraction. AVAIA's views already exclude Pink-tagged rows. |
| D9 | Foundation email failures are logged in AVAIA's `email_send_failures` | Pink log in AVAIA's table | **Remains** (0 rows). |
| D10 | Both organizations' scheduled runs and health results are in `cron_runs` and `system_check_results`; the Pink admin reads them | shared tables | **Remains.** Ends at extraction. |
| D11 | Foundation admin and AVAIA admin both authenticate against AVAIA's `profiles` / Supabase Auth (one admin account) | shared identity | **Remains.** |
| D12 | The research job's AI usage is logged in AVAIA's `ai_usage_events` (feature `prospect_research`) | shared log | **Remains.** |

No code path reads AVAIA participant, Journey, Workbook, Guide or member data on the Foundation's behalf
(`scripts/pink-isolation.sh`, rule B, fails the build if the Foundation's files start to).

## Technical infrastructure shared today

| Item | Shared how |
|---|---|
| Code repository | The Foundation's backend, admin and cron live in `avaiainstitute/avaia-platform` with AVAIA. (The public site is separate: `avaiainstitute/pink-shoelace-foundation`.) |
| Hosting / deployment | The backend is deployed by AVAIA's one Vercel project; an AVAIA deploy deploys Pink, and a broken AVAIA build blocks Pink. |
| Database | One Supabase project (`fupalguhcdlxosocbymc`). The Foundation's routes use the same service-role key that unlocks all AVAIA data. |
| Secrets | `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `CRON_SECRET`, `ANTHROPIC_API_KEY` are AVAIA's and are used by Foundation code. Foundation-specific names exist (`PINK_NOTIFICATION_EMAIL`, `PINK_SITE_ORIGIN`, `PINK_FROM_EMAIL`, `PINK_RESEND_API_KEY`, follow-up day counts). |
| Email | One Resend account. Foundation email was `AVAIA <noreply@avaiainstitute.com>`; it now says "The Pink Shoelace Foundation" but is still sent from AVAIA's domain until `PINK_FROM_EMAIL` is set. |
| Scheduled jobs | Both organizations' jobs run from AVAIA's `vercel.json`. The Foundation's: `pink-daily-summary` (12:35 UTC). |
| Health checks | AVAIA's System Checks run the Foundation's page and route checks every six hours. |
| Backups | The one Supabase project. The Supabase API shows no backup and no point-in-time recovery on it (checked 2026-10-05), so there is nothing the Foundation could restore independently. |
| Domains / DNS | `thepinkshoelace.org` and `avaiainstitute.com` both use Cloudflare name servers, and both show the same name server pair, which indicates one Cloudflare account. Foundation mail (MX) is Google Workspace. |
| Analytics | AVAIA's site analytics component only. The Foundation's site has none. |
| Storage | Not used by the Foundation. |

## Public, by design (not data)

The Foundation's public pages link to AVAIA's site (About "relationship to AVAIA," Resources, the home
page doorway to Defying Grief). These are public links, not data flows. Whether they should stay is a
Founder question (see `SOURCE_AUTHORITY.md`, class 3 and 5).
