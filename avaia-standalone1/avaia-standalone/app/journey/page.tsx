import { redirect } from "next/navigation";

// PROOF OF CONCEPT — disabled on this branch (gpt-iap-handoff) only. This
// preview exclusively tests the GPT-hosted IAP flow; the website's built-in
// IAP conversation engine is not part of what's being proven, so every
// route into /journey (with or without ?new=1) redirects to the handoff
// page instead, closing off the only other entry point a Host could land
// on. main's /journey is completely untouched — this change lives on this
// branch alone.
export const dynamic = "force-dynamic";

export default function JourneyPage() {
  redirect("/gpt-iap-preview");
}
