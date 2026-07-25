import AboutContent from "@/components/AboutContent";

export const metadata = { title: "AVAIA — Clarity Starts With Integrity" };

/**
 * The site root shows the institution's governing content (the same page as
 * /about, which the nav points at). Rendered from a shared component rather than
 * redirecting — a statically prerendered redirect emits a 307 with no Location.
 */
export default function Home() {
  return <AboutContent />;
}
