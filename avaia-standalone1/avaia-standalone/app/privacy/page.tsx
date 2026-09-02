export const metadata = { title: "Privacy Policy — AVAIA" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <p className="label mb-3">AVAIA Enterprises, LLC</p>
      <h1 className="font-serif text-4xl text-ink">Privacy Policy</h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">
        This describes what AVAIA collects, why, and who can see it. AVAIA exists to hold a
        conversation that belongs to the Host — that same principle governs how their information
        is handled here.
      </p>

      <section className="mt-10">
        <p className="font-serif text-xl text-seal">What we collect</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-ink">
          <li>Your email address, used to sign you in with a one-time code — no password is stored.</li>
          <li>
            The content of your conversations with an AVAIA Guide, and the referrals generated
            from them, saved to your own Workbook.
          </li>
          <li>
            If you use Unsung Heroes, the names and context you choose to include (e.g. a school,
            teacher, or guardian) as part of your own recognition record.
          </li>
          <li>Your membership status, handled through our payment processor, Stripe — AVAIA never sees or stores your card details.</li>
          <li>
            If you connect a custom AVAIA GPT in ChatGPT, a technical access token that identifies
            your account to AVAIA — not your ChatGPT conversation itself.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <p className="font-serif text-xl text-seal">How it&rsquo;s used</p>
        <p className="mt-3 leading-relaxed text-ink">
          Your conversation content is sent to Anthropic&rsquo;s Claude API to generate the
          Guide&rsquo;s responses, and, if you complete a conversation through one of AVAIA&rsquo;s
          connected ChatGPT GPTs, that conversation happens on OpenAI&rsquo;s platform under
          OpenAI&rsquo;s own privacy policy — only the finished referral you choose to submit is
          sent back to AVAIA. Your email is used only to sign you in and, if you request a
          sign-in code or a Workbook-sharing invite, to deliver that specific email through our
          provider, Resend.
        </p>
        <p className="mt-3 leading-relaxed text-ink">
          We do not sell your information, and we do not use it for advertising.
        </p>
      </section>

      <section className="mt-10">
        <p className="font-serif text-xl text-seal">Who can see it</p>
        <p className="mt-3 leading-relaxed text-ink">
          Your Workbook, conversations, referrals, and Unsung Heroes recognitions are private to
          your own account by default, enforced at the database level — not just hidden in the
          interface. The only way anyone else ever sees any of it is if you explicitly share a
          specific entry using AVAIA&rsquo;s own Share feature.
        </p>
      </section>

      <section className="mt-10">
        <p className="font-serif text-xl text-seal">Service providers</p>
        <p className="mt-3 leading-relaxed text-ink">
          AVAIA relies on a small number of providers to operate: Supabase (account creation,
          authentication, and database storage), Anthropic (generating Guide responses), OpenAI
          (only if you use a connected ChatGPT GPT), Stripe (payment processing), Resend
          (transactional email), and Vercel (hosting). Each only receives what it needs to perform
          its specific function.
        </p>
      </section>

      <section className="mt-10">
        <p className="font-serif text-xl text-seal">Your choices</p>
        <p className="mt-3 leading-relaxed text-ink">
          You can request a copy of your data or ask that your account and its contents be
          deleted at any time by contacting us at{" "}
          <a href="mailto:privacy@avaiainstitute.com" className="text-seal underline">
            privacy@avaiainstitute.com
          </a>
          .
        </p>
      </section>

      <p className="mt-12 text-sm text-muted">Last updated: 2026.</p>
    </div>
  );
}
