# AVAIA Demonstration: presenter script (about 14 minutes)

**Site:** https://demo.avaiainstitute.com  (a separate demo environment with its own database; nothing here touches a real person or Production)

## Say this at the start (Founder-approved wording)

> "This demonstration uses a pre-written synthetic Host scenario so the full AVAIA experience can be shown consistently. The product behavior, continuity, coordination, sharing and Guide access shown are the real AVAIA system."

Do not say or imply the conversations were generated live. All names and data are synthetic.

## The scenario in one breath
Eleanor Marsh, 63. Her father Walter, 86, fell in September. Everyone asks her: *should Dad sell the house?* Her brother Paul, four hours away, wants to sell now. Walter's power of attorney is unconfirmed. His taxes are due. Eleanor says, in her own words, that her capacity has changed. AVAIA assesses and declares nobody's legal or medical capacity.

## Before you present (5 minutes, every time)
1. Open `https://demo.avaiainstitute.com/demo-reset`, type the passphrase, click **Reset the demo**; every check on the page must say PASS. (The SQL files in `supabase/demo/` remain as a fallback.)
2. Open two browser windows (use two profiles so the sessions stay separate). Sign in with these addresses so each lands on the right page: Host `https://demo.avaiainstitute.com/sign-in?from=/workbook`, Guide `https://demo.avaiainstitute.com/sign-in?from=/guided-coordination`:
   - **Window A:** signed in as the Host, `kidathart+avaia-demo-host@gmail.com`.
   - **Window B:** signed in as the Guide, `kidathart+avaia-demo-guide@gmail.com`.
3. Open your Gmail with the attorney address's mail visible (`kidathart+avaia-demo-attorney@gmail.com` lands in your own inbox).
4. Never open an admin page. Neither demo account is an admin.

## The walkthrough

| Min | Window | Route | What to show and say |
|---|---|---|---|
| 0:00 | A | `/workbook` | "This is Eleanor's Workbook. Everything in it is hers." Scroll to the **Individual Awareness Profile** conversation: what she first came in with, "Should Dad sell the house?" |
| 1:30 | A | `/workbook` | The **CAT** and **InnerCompass** conversations: what became visible underneath the house question (her father's independence), and the direction she chose, with her own **next step** and **what to preserve**. Point out her capacity note is in her own words. |
| 3:30 | A | `/workbook/coordination` | "AVAIA never fills this in." Four items: **Open**, **Waiting**, **Closed**, and one **decision**. Point to who carries each and what is waiting on whom: all chosen by Eleanor. |
| 5:00 | A | open **Whether Dad stays in his house** | The **Decision & Capacity Continuity record**: her words over five weeks, in order, from her own conversations. Show the entry she **withdrew** (kept, flagged). Show **My position changed**: "AVAIA never decided her position changed; she did." |
| 7:30 | A | open **Confirm Dad's power of attorney…** then **Share with someone** (`/workbook/coordination/<item>/share`) | Fill **Their name:** Priya Raman. **Their email:** `kidathart+avaia-demo-attorney@gmail.com`. **Their role:** Attorney. **How long the link lasts:** 7. **Why you are sharing this:** a sentence in Eleanor's voice. Tick only what goes in (the item, plus the continuity entries she chooses; leave the withdrawn one out). Click **Preview what they will see**, read the authorization statement, authorize. |
| 10:00 | Gmail, then new tab | email, then `/handoff/<link>` | "The email carries no content." Open the link: a frozen, read-only copy, no account needed, shows who shared it and when it ends. "Priya sees only what Eleanor approved." |
| 11:30 | A | `/workbook/coordination/guide` | **Give a Guide access:** choose **Nora Castellane**, **14** days, tick the power-of-attorney item and the decision with two entries. Read the authorization wording aloud (what a Guide can and cannot do). Authorize. |
| 12:30 | B | `/guided-coordination` then the grant | Nora sees **only** what was ticked. Record **Contacted a professional** with one sentence. Show there is no way to edit Eleanor's decision, her entries, who owns what, or her shares. |
| 13:30 | A | the item page, then `/workbook/coordination/guide` | Nora's note appears in a **separate Guide lane**, labelled as hers; Eleanor's own entries are untouched. Click to **end the Guide's access**. "Eleanor stays in control." |

If you are short of time, skip the CAT/InnerCompass detail at 1:30 and shorten 3:30.

## After the demonstration
Run `demo_reset_and_seed.sql` and then `demo_baseline_check.sql` again. The live share link and Guide access are removed by the reset, so the next presenter starts from the same baseline.

## Good to know
- Share links last up to 30 days and Guide access up to 90 days. The reset clears both regardless.
- Only two emails are ever sent: the Share With email (to the attorney address) and the Guide-access email (to the Guide address). Type those addresses exactly; do not type a real person's address into the demo.
- The Journey conversations are stored text, not live AI. There is no AI key in this environment.
- On the decision's timeline each entry shows two dates: **"Said …"** (when Eleanor wrote it in her own conversation, weeks ago) and **"Added to your record …"** (the day the reset was run). That is how the real product works when a Host brings her own earlier words forward. Say so: "she brought these forward from her own conversations."
- A withdrawn entry is never erased. It stays on the timeline, marked, and "Show what was recorded" opens it.
- After signing in, AVAIA always lands on the **Journey** page (and that can create an empty Journey record for the account). Sign in to both windows BEFORE you present, then go straight to the address you need (`/workbook`, `/guided-coordination`). Do not open /journey during the demo. A reset clears any empty record.
