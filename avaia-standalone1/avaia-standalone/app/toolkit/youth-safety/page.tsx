import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Youth Safety Procedure — Guide Toolkit — AVAIA" };
export const dynamic = "force-dynamic";

/** Guide-facing procedure document -- NOT a policy page. The governing
 *  policy itself (what's private, what the one exception is, who's
 *  responsible for acting on it) was already decided and is documented in
 *  lib/youth-assent-text.ts, shown to every guardian and Youth Host at
 *  consent. This page answers the one thing that document was never meant
 *  to answer: what does a Certified Guide concretely DO, in the moment,
 *  when they judge the exception applies. Training material, reachable
 *  from the Toolkit dashboard's own Youth section (see app/toolkit/
 *  page.tsx), not a second policy. */
export default async function YouthSafetyProcedurePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit/youth-safety");

  return (
    <div>
      <p className="mb-6">
        <Link href="/toolkit" className="label hover:text-seal">
          ← Back to Dashboard
        </Link>
      </p>
      <p className="label mb-3">For Certified Guides</p>
      <h1 className="font-serif text-3xl text-ink">Youth Safety — What To Actually Do</h1>
      <p className="mt-4 text-lg text-muted">
        This is a procedure, not a policy. The governing rule is already settled and does not
        change here:{" "}
        <span className="text-ink">
          a Youth Host&rsquo;s private conversation stays private; guardian permission authorizes
          participation, not access; and the one narrow exception is a genuine safety concern,
          handled by you, the human Guide, the same way any responsible adult would
        </span>
        . This page is about what that actually looks like in the moment.
      </p>

      <section className="rule-t mt-12 border-t border-rule pt-8">
        <p className="label mb-2 text-seal">1</p>
        <h2 className="font-serif text-xl text-ink">What should you notice?</h2>
        <p className="mt-2 text-muted">
          Ordinary sadness, anger, grief, family conflict, loneliness, or difficult disclosure is
          expected material for AVAIA to hold — it is not on its own a warning sign, and it does
          not require any action beyond the conversation itself. What you&rsquo;re watching for is
          narrower and more specific: language indicating a real, current risk of harm — to the
          Youth Host themselves, or to someone else. Passive language still counts (&ldquo;everyone
          would be better off without me,&rdquo; not only an explicit plan) — AVAIA&rsquo;s own
          conversational behavior is built to take that seriously without alarm, and so should you.
        </p>
      </section>

      <section className="rule-t mt-10 border-t border-rule pt-8">
        <p className="label mb-2 text-seal">2</p>
        <h2 className="font-serif text-xl text-ink">What should you do first?</h2>
        <p className="mt-2 text-muted">
          Stay present. Do not investigate, interrogate, diagnose, or try to resolve it yourself —
          that is not your role and is not what keeps the Youth Host safe. Get clear, plainly and
          directly, on what they actually mean (&ldquo;are you having thoughts of hurting yourself,
          or of not wanting to be here anymore?&rdquo;) rather than assuming. If there is immediate
          danger, treat it as the emergency it is — the same as you would for anyone, anywhere,
          not a special AVAIA process.
        </p>
      </section>

      <section className="rule-t mt-10 border-t border-rule pt-8">
        <p className="label mb-2 text-seal">3</p>
        <h2 className="font-serif text-xl text-ink">How should you speak to the Youth Host?</h2>
        <p className="mt-2 text-muted">
          Calmly and directly — not clinically, not alarmed. Thank them for saying it; naming a
          hard thing out loud takes something. Do not make them feel reported on before anything
          has actually happened. Preserve their dignity and their voice as much as the situation
          allows — this is still their conversation, even now.
        </p>
      </section>

      <section className="rule-t mt-10 border-t border-rule pt-8">
        <p className="label mb-2 text-seal">4</p>
        <h2 className="font-serif text-xl text-ink">
          When should a trusted adult or guardian be involved?
        </h2>
        <p className="mt-2 text-muted">
          Only once you&rsquo;ve judged the narrow exception genuinely applies — a real safety
          concern, not ordinary difficulty. When it does, involve a guardian or another trusted,
          responsible adult the same way you would for any young person in your care, using your
          own judgment about who and how. This is not a lower bar than you&rsquo;d apply anywhere
          else in your life, and it is not a higher one either.
        </p>
      </section>

      <section className="rule-t mt-10 border-t border-rule pt-8">
        <p className="label mb-2 text-seal">5</p>
        <h2 className="font-serif text-xl text-ink">What should you document?</h2>
        <p className="mt-2 text-muted">
          That a safety concern arose, roughly when, and what you did about it — who you involved
          and when. Enough for you (and AVAIA, if ever asked) to know the exception was applied
          appropriately.
        </p>
      </section>

      <section className="rule-t mt-10 border-t border-rule pt-8">
        <p className="label mb-2 text-seal">6</p>
        <h2 className="font-serif text-xl text-ink">What should you NOT document?</h2>
        <p className="mt-2 text-muted">
          Do not write down the Youth Host&rsquo;s private conversation content itself, beyond
          what&rsquo;s directly necessary to explain the safety concern. Their private words remain
          theirs — this exception is about their safety, not a license to create a written record
          of everything they said.
        </p>
      </section>

      <section className="rule-t mt-10 border-t border-rule pt-8">
        <p className="label mb-2 text-seal">7</p>
        <h2 className="font-serif text-xl text-ink">
          What should you never promise about confidentiality?
        </h2>
        <p className="mt-2 text-muted">
          Never promise a Youth Host that nothing they say could ever leave the room, full stop.
          The Youth assent language already states the real, narrow exception honestly — don&rsquo;t
          make a bigger promise than that in the moment, even to comfort them. An honest boundary
          held is more trustworthy than an absolute one that turns out not to be true.
        </p>
      </section>

      <section className="rule-t mt-10 border-t border-rule pt-8">
        <p className="label mb-2 text-seal">8</p>
        <h2 className="font-serif text-xl text-ink">
          What should you never automatically disclose?
        </h2>
        <p className="mt-2 text-muted">
          Ordinary sadness, anger, grief, family conflict, identity questions, or any other
          difficult-but-not-dangerous disclosure. A guardian, school, or sponsoring organization
          does not get access to a Youth Host&rsquo;s private conversation just because they
          authorized or paid for participation — that is true before, during, and after this
          exception is ever considered, and it does not loosen just because something hard came up.
        </p>
      </section>

      <section className="rule-t mt-10 border-t border-rule pt-8">
        <p className="label mb-2 text-seal">9</p>
        <h2 className="font-serif text-xl text-ink">What role does AVAIA&rsquo;s software play?</h2>
        <p className="mt-2 text-muted">
          It stays present, responds calmly, and encourages the Youth Host toward a trusted adult
          when appropriate — the same conversational behavior in every Youth conversation, whether
          you&rsquo;re facilitating it live or not. It does not notify anyone automatically. There
          is no automated alert, no dashboard flag, no software-driven escalation to you, a
          guardian, or anyone else. That was a deliberate decision, not a missing feature — the
          judgment call belongs to you.
        </p>
      </section>

      <section className="rule-t mt-10 border-t border-rule pt-8">
        <p className="label mb-2 text-seal">10</p>
        <h2 className="font-serif text-xl text-ink">What role do you play?</h2>
        <p className="mt-2 text-muted">
          All of it. You are the responsible adult in the room, in the same sense any teacher,
          coach, or relative would be if this came up in front of them. AVAIA gives the Youth Host
          a real, private place to say something true. What happens next, if it ever needs to, is
          yours to judge and yours to act on.
        </p>
      </section>
    </div>
  );
}
