# Avaia — Anonymous Usage Trends

Lightweight event tracking that feeds a Google Sheet via Google Apps Script —
the same approach used in Yada. Used to understand usage and clicks for future
programs. No personal data is collected, and journaling text is never sent (it
stays on the user's account/device).

## What's collected

| Event | Fires when | Payload |
|---|---|---|
| `page.view` | Every route change | `path` |
| `click` | A link or button is clicked | `label`, `href`, `tag` |

Every row also carries a random per-browser `session_id`, a client timestamp,
the path, a coarse user-agent class, and the viewport width. Names, emails,
phone numbers, and journaling content are **not** collected.

## One-time setup

1. Create a Google Sheet; name the first tab `events`.
2. **Extensions → Apps Script**, paste `apps-script.gs`, save.
3. **Deploy → New deployment → Web app** — *Execute as: Me*, *Who has access:
   Anyone*. Authorize, then copy the `/exec` URL.
4. Set that URL as the environment variable **`NEXT_PUBLIC_AVAIA_TRACK_URL`** in
   the deployment (e.g. Vercel). Tracking activates on the next deploy.

The tracker (`lib/track.ts`) stays completely inert until that variable is set,
so nothing is sent in development or before the sheet is wired up.
