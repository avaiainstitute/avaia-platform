import { createHash, timingSafeEqual } from "crypto";
import { notFound, redirect } from "next/navigation";
import { demoBaselineChecks, resetDemo, sendDemoTestEmails, type DemoCheck } from "@/lib/demo/demo-reset";

export const metadata = { title: "Demo reset", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// DEMONSTRATION RESET PAGE. It exists only where DEMO_RESET_PASSPHRASE is set (the separate demo environment). Everywhere else, including
// Production, there is no such variable and this page is simply "not found". The reset itself also refuses to run unless the database holds
// exactly the two synthetic demo accounts.

function configuredPassphrase(): string {
  const p = process.env.DEMO_RESET_PASSPHRASE ?? "";
  return p.length >= 8 ? p : "";
}

function sameSecret(given: string, expected: string): boolean {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export default async function DemoResetPage({ searchParams }: { searchParams: { ran?: string; error?: string; sent?: string } }) {
  if (!configuredPassphrase()) notFound();

  async function resetAction(formData: FormData) {
    "use server";
    const expected = configuredPassphrase();
    if (!expected) notFound();
    const given = String(formData.get("passphrase") ?? "");
    if (!sameSecret(given, expected)) redirect(`/demo-reset?error=${encodeURIComponent("That passphrase is not right.")}`);
    let failure: string | null = null;
    try {
      await resetDemo();
    } catch (e) {
      failure = e instanceof Error ? e.message : String(e);
    }
    if (failure) redirect(`/demo-reset?error=${encodeURIComponent(failure)}`);
    redirect("/demo-reset?ran=reset");
  }

  async function checkAction() {
    "use server";
    if (!configuredPassphrase()) notFound();
    redirect("/demo-reset?ran=check");
  }

  async function testEmailsAction(formData: FormData) {
    "use server";
    const expected = configuredPassphrase();
    if (!expected) notFound();
    const given = String(formData.get("passphrase") ?? "");
    if (!sameSecret(given, expected)) redirect(`/demo-reset?error=${encodeURIComponent("That passphrase is not right.")}`);
    let failure: string | null = null;
    let message = "";
    try {
      message = await sendDemoTestEmails();
    } catch (e) {
      failure = e instanceof Error ? e.message : String(e);
    }
    if (failure) redirect(`/demo-reset?error=${encodeURIComponent(failure)}`);
    redirect(`/demo-reset?sent=${encodeURIComponent(message)}`);
  }

  let checks: DemoCheck[] | null = null;
  let checkFailure: string | null = null;
  if (searchParams.ran === "reset" || searchParams.ran === "check") {
    try {
      checks = await demoBaselineChecks();
    } catch (e) {
      checkFailure = e instanceof Error ? e.message : String(e);
    }
  }
  const allPass = checks !== null && checks.every((c) => c.ok);

  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <p className="label mb-3">Demonstration</p>
      <h1 className="font-serif text-4xl text-ink">Reset the demo</h1>
      <p className="mt-4 text-muted">
        This puts the demonstration back to its exact starting point: Eleanor Marsh&rsquo;s Journey, her Coordination items and decision, and
        Nora Castellane&rsquo;s Guide records. Any share or Guide access made during a demonstration is removed. Everything here is synthetic.
      </p>

      {searchParams.error && (
        <p className="mt-6 rounded-md border border-[#e0857d]/40 bg-[#e0857d]/[0.08] px-4 py-3 text-sm text-[#e0857d]">{searchParams.error}</p>
      )}
      {searchParams.sent && !searchParams.error && (
        <p className="mt-6 rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-sm text-ink">{searchParams.sent}</p>
      )}
      {searchParams.ran === "reset" && !searchParams.error && (
        <p className="mt-6 rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-sm text-ink">The demo was reset.</p>
      )}

      <form action={resetAction} className="mt-8">
        <label className="label mb-2 block" htmlFor="passphrase">
          Passphrase
        </label>
        <input
          id="passphrase"
          name="passphrase"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
        />
        <button type="submit" className="mt-4 rounded-md border border-rule px-5 py-3 text-ink transition-colors hover:border-seal">
          Reset the demo
        </button>
        <button
          type="submit"
          formAction={testEmailsAction}
          className="mt-4 ml-3 rounded-md border border-rule px-5 py-3 text-sm text-muted transition-colors hover:border-seal"
        >
          Send a test of the two demo emails
        </button>
      </form>

      <form action={checkAction} className="mt-4">
        <button type="submit" className="rounded-md border border-rule px-5 py-3 text-sm text-muted transition-colors hover:border-seal">
          Check the demo (changes nothing)
        </button>
      </form>

      {checkFailure && <p className="mt-8 text-[#e0857d]">The check could not run: {checkFailure}</p>}
      {checks && (
        <section className="mt-10">
          <h2 className="font-serif text-2xl text-ink">{allPass ? "Ready: every check passes." : "Not ready: something differs from the baseline."}</h2>
          <ul className="mt-4 space-y-2">
            {checks.map((c) => (
              <li key={c.name} className="rounded-md border border-rule px-4 py-3 text-sm">
                <span className={c.ok ? "label text-ink" : "label text-[#e0857d]"}>{c.ok ? "PASS" : "FAIL"}</span>
                <span className="ml-3 text-ink">{c.name}</span>
                <span className="mt-1 block text-muted">{c.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
