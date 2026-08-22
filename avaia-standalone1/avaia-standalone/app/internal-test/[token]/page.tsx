// TEMPORARY — Free IAP / Anonymous Auth validation route. Not linked from
// anywhere in the public app; protected by the random TEST_TOKEN path
// segment. Loading this page does nothing by itself -- only the "Run
// Test" button (a POST server action) creates anything. Delete this
// whole app/internal-test directory once validation is complete; never
// merge it to main.

import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { runTest, attachTestEmail, TEST_TOKEN } from "./actions";

export const dynamic = "force-dynamic";

type TestResult = {
  error?: string;
  userId?: string;
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

      {!result && (
        <form action={boundRunTest}>
          <button type="submit" style={{ padding: "10px 20px", fontSize: 16 }}>
            Run Test
          </button>
        </form>
      )}

      {result?.error && <p style={{ color: "crimson" }}>FAIL: {result.error}</p>}

      {result && !result.error && (
        <div>
          <h2>Result</h2>
          <ul>
            <li>Test user ID: {result.userId}</li>
            <li>Anonymous sign-in: PASS</li>
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

          <form action={boundRunTest}>
            <button type="submit">Run again (idempotent — reuses this same identity)</button>
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
                <button type="submit">Attach email</button>
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
