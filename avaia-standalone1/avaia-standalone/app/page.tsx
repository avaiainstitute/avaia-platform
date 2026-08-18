import HomeContent from "@/components/HomeContent";

export const metadata = { title: "AVAIA — Clarity Starts With Integrity" };

/**
 * The site root is its own minimal front door -- what is this, why might I
 * care, where do I start -- distinct from /about, which now carries the
 * deeper institutional explanation. See components/HomeContent.tsx.
 */
export default function Home() {
  return <HomeContent />;
}
