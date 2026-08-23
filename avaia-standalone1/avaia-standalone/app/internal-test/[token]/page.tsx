// TEMPORARY — Free IAP / Anonymous Auth validation route. Not linked from
// anywhere in the public app; protected by the random TEST_TOKEN path
// segment. Loading this page does nothing by itself -- only the "Run
// Test" button (a POST server action) creates anything. Delete this
// whole app/internal-test directory once validation is complete; never
// merge it to main.

import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { runTest, attachTestEmail } from "./actions";
import { TEST_TOKEN } from "./token";

export const dynamic = "force-dynamic";

// Explicit styling on every button below -- this page renders inside
// AVAIA's normal site layout, whose global CSS reset strips default
// browser button chrome down to something that can look like plain,
// unclickable text. Inline styles here are deliberate and self-
// contained so button visibility never again depends on inherited CSS.
const buttonStyle: CSSProperties = {
  padding: "10px 20px",
  fontSize: 16,
  background: "#1a1a1a",
  color: "#fff",
  border: "1px solid #1a1a1a",
  borderRadius: 4,
  cursor: "pointer",
};

type TestResult = {
  error?: string;
  userId?: string;
  email?: string | null;
  isAnonymous?: boolean;
  profileFound?: boolean;
  role?: string | null;
  membershipStatus?: string | null;
  journeyId?: string;
  journeyReused?: boolean;
  conversationId?: string;
  conversationReused?: boolean;
  rlsCrossUserBlocked?: boolean;
  ranAt?: string;
  emailAttachAttempted?: boolean;
  emailAttachOutcome?: string;
};

export default function InternalTestPage({ params }: { params: { token: string } }) {
  if (params.token !== TEST_TOKEN) notFound();

  const jar = cookies();
  const raw = jar.get("avaia_test_result")?.value;
  const result: TestResult | null = raw ? JSON.parse(raw) : null;

  const boundRunTest = runTest.bind(null, params.token);
  const boundAttachEmail = attachTestEmail.bind(null, params.token);

  return (
    <div style={{ maxWidth: 640, margin: "48px auto", padding: "0 20px", fontFamily: "system-ui, sans-serif" }}>
      <h1>Internal validation — Free IAP / Anonymous Auth</h1>
      <p style={{ color: "#666" }}>
        Temporary route. Not linked from the public site. Removed after validation.
      </p>

      {(!result || result.error) && (
        <form action={boundRunTest}>
          <button type="submit" style={buttonStyle}>
            {result?.error ? "Try again" : "Run Test"}
          </button>
        </form>
      )}

      {result?.error && (
        <div>
          <p style={{ color: "crimson" }}>FAIL: {result.error}</p>
          {result.userId && <p>Known test user ID: {result.userId}</p>}
        </div>
      )}

      {result && !result.error && (
        <div>
          <h2>Result</h2>
          <ul>
            <li>Test user ID: {result.userId}</li>
            <li>Anonymous sign-in: PASS</li>
            <li>
              is_anonymous: {String(result.isAnonymous)}{" "}
              {result.isAnonymous === false
                ? "— converted to a permanent identity"
                : result.isAnonymous === true
                  ? "— still anonymous"
                  : ""}
            </li>
            <li>Email attached: {result.email ?? "(none yet)"}</li>
            <li>
              Profile auto-created by trigger:{" "}
              {result.profileFound ? "PASS" : "FAIL — no profile row found"}
            </li>
            <li>
              role: {result.role ?? "(missing)"}{" "}
              {result.role === "member" ? "— PASS" : "— check"}
            </li>
            <li>
              membership_status: {result.membershipStatus ?? "(missing)"}{" "}
              {result.membershipStatus === "free" ? "— PASS" : "— check"}
            </li>
            <li>
              Journey:{" "}
              {result.journeyReused
                ? "reused existing test Journey — PASS (idempotent)"
                : "created — PASS"}
            </li>
            <li>
              Conversation:{" "}
              {result.conversationReused
                ? "reused existing test conversation — PASS (idempotent)"
                : "created — PASS"}
            </li>
            <li>
              RLS blocks other Hosts&rsquo; data from this anonymous user:{" "}
              {result.rlsCrossUserBlocked ? "PASS" : "FAIL — foreign row was visible"}
            </li>
          </ul>

          <form action={boundRunTest} style={{ marginTop: 20 }}>
            <button type="submit" style={buttonStyle}>
              Run again (idempotent — reuses this same identity)
            </button>
          </form>

          {!result.emailAttachAttempted && (
            <>
              <h2 style={{ marginTop: 32 }}>Step 2 — Email attachment</h2>
              <p style={{ color: "#a00" }}>
                Hold off here until this first result is confirmed and reported back.
              </p>
              <form action={boundAttachEmail}>
                <input
                  type="email"
                  name="email"
                  placeholder="test email address"
                  required
                  style={{ padding: 8, marginRight: 8 }}
                />
                <button type="submit" style={buttonStyle}>
                  Attach email
                </button>
              </form>
            </>
          )}

          {result.emailAttachAttempted && (
            <p>Email attachment result: {result.emailAttachOutcome}</p>
          )}
        </div>
      )}
    </div>
  );
}
