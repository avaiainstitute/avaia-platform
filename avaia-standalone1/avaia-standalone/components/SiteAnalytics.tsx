"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/track";

/**
 * Site-wide anonymous analytics. Fires a `page.view` on every route change and a
 * `click` for links and buttons, so we can see usage and clicks for future
 * programs. Inert unless NEXT_PUBLIC_AVAIA_TRACK_URL is set (see lib/track.ts).
 */
export default function SiteAnalytics() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  // page.view on navigation (guarded against double-fire).
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    track("page.view", { path: pathname });
  }, [pathname]);

  // Delegated click tracking for links and buttons.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const el = (e.target as HTMLElement | null)?.closest("a, button");
      if (!el) return;
      const label = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80);
      const href = el instanceof HTMLAnchorElement ? el.getAttribute("href") || "" : "";
      track("click", { label, href, tag: el.tagName.toLowerCase() });
    }
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
