/**
 * Avaia — Anonymous Usage Trends — Google Apps Script Web App
 *
 * Receives POSTs from the Avaia app (lib/track.ts) and appends one row per
 * event to a Google Sheet. No personal data is collected — the client sends a
 * random per-browser session id plus a small JSON payload of categorical
 * fields (event, path, clicked label, program slug, word count). Journaling
 * text is NEVER sent; it stays on the user's own device.
 *
 * Setup (one-time):
 *   1) Create a new Google Sheet. Name the first tab `events`.
 *   2) Tools -> Apps Script. Paste this file in as Code.gs. Save.
 *   3) Deploy -> New deployment -> type: Web app.
 *        - Execute as: Me
 *        - Who has access: Anyone
 *      Authorize when prompted. Copy the resulting /exec URL.
 *   4) Set that /exec URL as NEXT_PUBLIC_AVAIA_TRACK_URL in the deployment
 *      environment (Vercel). Tracking activates on the next deploy.
 *
 * To re-deploy after editing later: Deploy -> Manage deployments -> edit the
 * existing one -> Version: New version -> Deploy. Keep the same /exec URL.
 */

const SHEET_NAME = 'events';

function doPost(e) {
  try {
    const raw = (e && e.postData && e.postData.contents) || '{}';
    const body = JSON.parse(raw);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'server_received_at', 'client_ts', 'session_id', 'event', 'path',
        'ua', 'viewport', 'payload_json', 'label', 'href', 'slug', 'word_count'
      ]);
      sheet.setFrozenRows(1);
    }

    const payload = (body && body.payload && typeof body.payload === 'object') ? body.payload : {};

    sheet.appendRow([
      new Date(),                                         // A: server time
      body.ts || '',                                      // B: client iso ts
      body.sid || '',                                     // C: session id
      body.event || '',                                   // D: event name
      body.path || '',                                    // E: page path
      body.ua || '',                                      // F: ua class
      body.vw || '',                                      // G: viewport width
      JSON.stringify(payload),                            // H: full payload
      payload.label || '',                                // I: clicked label
      payload.href || '',                                 // J: clicked href
      payload.slug || '',                                 // K: program slug
      payload.wordCount != null ? payload.wordCount : ''  // L: word count
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    console.error('Avaia track error:', err);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService
    .createTextOutput('Avaia analytics endpoint — ready. POST JSON events here.')
    .setMimeType(ContentService.MimeType.TEXT);
}
