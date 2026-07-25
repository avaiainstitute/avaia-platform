// Anonymous usage tracking — same lightweight approach as Yada.
//
// Fires small JSON events (event name + categorical payload) to a Google Apps
// Script endpoint that appends rows to a Google Sheet. No personal data: just a
// random per-browser session id. Journaling TEXT is never sent — it stays on the
// user's device (see lib/journal.ts).
//
// The module stays completely inert until NEXT_PUBLIC_AVAIA_TRACK_URL is set, so
// nothing is sent in development or before the sheet is wired up.

const TRACK_URL = process.env.NEXT_PUBLIC_AVAIA_TRACK_URL || "";

const SESSION_ID_KEY = "avaia.session-id";

function getOrCreateSessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_ID_KEY);
    if (!id) {
      id = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(SESSION_ID_KEY, id);
    }
    return id;
  } catch {
    return "no-storage";
  }
}

function uaClass(): string {
  if (typeof navigator === "undefined") return "server";
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Macintosh/i.test(ua)) return "mac";
  if (/Windows/i.test(ua)) return "windows";
  return "other";
}

export function trackEnabled(): boolean {
  return !!TRACK_URL;
}

export function track(eventName: string, payload?: Record<string, unknown>): boolean {
  if (!TRACK_URL) return false;
  if (!eventName || typeof window === "undefined") return false;

  const body = {
    sid: getOrCreateSessionId(),
    ts: new Date().toISOString(),
    event: eventName,
    path: window.location.pathname,
    ua: uaClass(),
    vw: window.innerWidth,
    payload: payload && typeof payload === "object" ? payload : null,
  };

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(body)], { type: "text/plain" });
      if (navigator.sendBeacon(TRACK_URL, blob)) return true;
    }
  } catch {
    /* fall through to fetch */
  }
  try {
    fetch(TRACK_URL, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      keepalive: true,
    });
    return true;
  } catch {
    return false;
  }
}
