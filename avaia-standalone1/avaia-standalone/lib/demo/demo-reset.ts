import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { guideCoordinationEmailHtml, guideCoordinationSubject, handoffInvitationEmailHtml, handoffInvitationSubject, sendEmail } from "@/lib/resend";

// DEMONSTRATION RESET. Only ever reachable through app/demo-reset, which does not exist unless DEMO_RESET_PASSPHRASE is set (it never is in
// Production). This rebuilds the baseline of the synthetic demonstration (Eleanor Marsh, the Host; Nora Castellane, the Guide) exactly as
// supabase/demo/demo_reset_and_seed.sql does, using the same service key the rest of the server uses.
//
// SAFETY: it refuses to run unless the database contains EXACTLY the two demo accounts. It only ever reads or deletes rows that belong to those
// two accounts. All data is synthetic. The Journey conversations are pre-written demonstration content, not live AI output.

export const DEMO_HOST_EMAIL = "kidathart+avaia-demo-host@gmail.com";
export const DEMO_GUIDE_EMAIL = "kidathart+avaia-demo-guide@gmail.com";
export const DEMO_ATTORNEY_EMAIL = "kidathart+avaia-demo-attorney@gmail.com";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

type Row = Record<string, unknown>;

function must(label: string, res: { error: { message: string } | null }): void {
  if (res.error) throw new Error(`${label}: ${res.error.message}`);
}

async function insertOne(db: SupabaseClient, table: string, row: Row): Promise<string> {
  const res = await db.from(table).insert(row).select("id").single();
  if (res.error || !res.data) throw new Error(`${table}: ${res.error?.message ?? "no row returned"}`);
  return (res.data as { id: string }).id;
}

/** Midday US time (17:00 UTC) today, so seeded messages are never stamped in the middle of the night. */
function dayBase(): number {
  const d = new Date();
  d.setUTCHours(17, 0, 0, 0);
  return d.getTime();
}
function before(base: number, days: number, hours = 0, minutes = 0): string {
  return new Date(base - (days * DAY + hours * HOUR + minutes * MIN)).toISOString();
}
function daysAgo(days: number): string {
  return new Date(Date.now() - days * DAY).toISOString();
}
function dateInDays(days: number): string {
  return new Date(Date.now() + days * DAY).toISOString().slice(0, 10);
}

/** The two demo accounts, and a refusal if anything else is in this database. */
async function demoAccounts(db: SupabaseClient): Promise<{ host: string; guide: string }> {
  const res = await db.auth.admin.listUsers({ page: 1, perPage: 50 });
  if (res.error) throw new Error(`Could not read the accounts: ${res.error.message}`);
  const users = res.data.users;
  const host = users.find((u) => (u.email ?? "").toLowerCase() === DEMO_HOST_EMAIL);
  const guide = users.find((u) => (u.email ?? "").toLowerCase() === DEMO_GUIDE_EMAIL);
  if (!host || !guide) throw new Error(`The two demo users do not exist yet. Create ${DEMO_HOST_EMAIL} and ${DEMO_GUIDE_EMAIL} in Supabase (Authentication, Users).`);
  if (users.length !== 2) throw new Error("REFUSED: this database has accounts other than the two demo accounts. The reset is for the demo database only.");
  return { host: host.id, guide: guide.id };
}

// Eleanor's own sentences. Each continuity entry copies one of these verbatim from a message she wrote on the date it shows.
const X = {
  wanted: "I want Dad to stay in his house as long as he can be safe there.",
  understood: "After the fall, the hospital social worker said he should not be alone overnight.",
  reasoning: "I can't be there every night, and Paul is four hours away.",
  question: "I asked the care manager what overnight help costs and whether his insurance covers any.",
  alt: "Maybe a live-in aide for six months, before we decide anything about the sale.",
  undecided: "I still don't know whether selling is right.",
  position:
    "I used to say he should stay as long as possible. Now I think he stays only if overnight help is in place, and we decide about the sale after I meet the attorney.",
  comm: "Tell Paul I'm not deciding about the sale until the attorney has reviewed Dad's documents.",
};

export async function resetDemo(): Promise<string[]> {
  const db: SupabaseClient = createAdminClient();
  const log: string[] = [];
  const { host, guide } = await demoAccounts(db);
  const base = dayBase();

  // RESET: everything that belongs to the two demo accounts, children before parents.
  for (const t of ["coordination_guide_events", "coordination_guide_scope", "coordination_guide_grants", "coordination_shares", "coordination_entries", "coordination_items", "referrals", "conversations", "journeys"]) {
    must(`reset ${t}`, await db.from(t).delete().eq("host_id", host));
  }
  must("reset guide conversations", await db.from("conversations").delete().eq("host_id", guide));
  must("reset guide journeys", await db.from("journeys").delete().eq("host_id", guide));
  for (const t of ["guide_platform_authorizations", "guide_certifications", "guide_candidates"]) {
    must(`reset ${t}`, await db.from(t).delete().eq("host_id", guide));
  }
  must("reset entitlements", await db.from("entitlements").delete().in("host_id", [host, guide]));
  log.push("Cleared the demo accounts' records.");

  // ACCOUNTS
  must("host profile", await db.from("profiles").update({ consent_at: daysAgo(40), disclaimer_version: "2026-07-10", adult_confirmed: true }).eq("id", host));
  must(
    "guide profile",
    await db
      .from("profiles")
      .update({ consent_at: daysAgo(130), disclaimer_version: "2026-07-10", adult_confirmed: true, role: "guide", guide_display_name: "Nora Castellane", guide_certified_at: daysAgo(120) })
      .eq("id", guide)
  );
  must("entitlements", await db.from("entitlements").insert([
    { host_id: host, status: "active", source: "founder_test" },
    { host_id: guide, status: "active", source: "founder_test" },
  ]));
  const cand = await insertOne(db, "guide_candidates", { host_id: guide, status: "admitted", admitted_at: daysAgo(200), notes: "Synthetic demonstration Guide. Not a real person." });
  must("guide certification", await db.from("guide_certifications").insert({ candidate_id: cand, host_id: guide, certified_at: daysAgo(120), standing: "active" }));
  must("guide authorization", await db.from("guide_platform_authorizations").insert({ host_id: guide, capability: "coordination_support", status: "authorized", granted_at: daysAgo(30), notes: "Synthetic demonstration Guide." }));
  log.push("Wrote the two accounts and the Guide's certification records.");

  // THE JOURNEY: IAP (36-35 days ago), CAT (22-20), InnerCompass (8-7).
  const journey = await insertOne(db, "journeys", { host_id: host, program: "general", started_at: daysAgo(36), completed_at: daysAgo(7) });
  const conv = async (stage: string, days: number): Promise<string> =>
    insertOne(db, "conversations", { host_id: host, stage, status: "complete", program: "general", journey_id: journey, created_at: daysAgo(days) });
  const msg = async (conversation: string, role: "host" | "guide", content: string, at: string): Promise<string> =>
    insertOne(db, "messages", { conversation_id: conversation, host_id: host, role, content, created_at: at });

  const iap = await conv("iap", 36);
  await msg(iap, "guide", "Welcome. You can bring whatever is present, in any order, and there is no right way to begin. What brought you here today?", before(base, 35, 1, 30));
  const mWanted = await msg(iap, "host", `My dad fell in September. Everyone keeps asking me the same thing: should Dad sell the house? ${X.wanted} He has lived there for fifty-one years.`, before(base, 35, 1, 25));
  await msg(iap, "guide", "Fifty-one years is a long time in one place. What do you know so far about how he is doing since the fall?", before(base, 35, 1, 20));
  const mUnderstood = await msg(iap, "host", `${X.understood} Dad is 86 and he insists he is fine.`, before(base, 35, 1, 10));
  await msg(iap, "guide", "Who else is part of this with you?", before(base, 34, 2));
  const mReasoning = await msg(iap, "host", `My brother Paul lives four hours away and thinks we should sell now. ${X.reasoning} I also don't know whether Dad's power of attorney papers are current.`, before(base, 34, 1, 50));
  await msg(iap, "guide", "What part of this feels most unsettled for you today?", before(base, 34, 1, 40));
  await msg(iap, "host", "That I am making decisions for someone who still wants to make his own. And that I am exhausted.", before(base, 34, 1, 35));
  await msg(iap, "guide", "Thank you for putting all of that on the table. I will gather what you have said into a record you can carry forward.", before(base, 34, 1, 30));

  const cat = await conv("cat", 22);
  await msg(cat, "guide", "Welcome back. Your earlier conversation is with us. What would you like to look at more closely today?", before(base, 21, 3));
  await msg(cat, "host", "I keep thinking this is about the house, but I think it is really about Dad's independence.", before(base, 21, 2, 55));
  await msg(cat, "guide", "What else changed for you when his independence changed?", before(base, 21, 2, 50));
  const mQuestion = await msg(cat, "host", `${X.question} She said it depends on the policy, and I don't know where his policy is.`, before(base, 21, 2, 40));
  await msg(cat, "guide", "Is there anything you have considered that you have not yet said out loud?", before(base, 20, 4));
  const mAlt = await msg(cat, "host", `${X.alt} I notice I am grieving something that has not happened yet.`, before(base, 20, 3, 50));
  await msg(cat, "guide", "That is worth carrying forward. I will record what became visible so you can bring it to your next conversation.", before(base, 20, 3, 40));

  const ic = await conv("innercompass", 8);
  await msg(ic, "guide", "Welcome. This is where you can look at a decision you are working through. What is it, in your own words?", before(base, 8, 2));
  const mUndecided = await msg(ic, "host", `${X.undecided} I have the money question, the safety question and Paul's opinion all mixed together.`, before(base, 8, 1, 50));
  await msg(ic, "guide", "What would you need to know to separate them?", before(base, 7, 3));
  const mPosition = await msg(ic, "host", `Whether his documents are in order, and what overnight help really costs. ${X.position}`, before(base, 7, 2, 50));
  await msg(ic, "guide", "Is there anything you want to be sure other people hear from you?", before(base, 7, 2, 40));
  const mComm = await msg(ic, "host", X.comm, before(base, 7, 2, 30));
  await msg(ic, "guide", "You have named a direction and a next step in your own words. I will record it exactly as you said it.", before(base, 7, 2, 20));
  log.push("Wrote the completed Journey: IAP, CAT and InnerCompass, 23 messages.");

  // THE THREE REFERRALS
  await insertOne(db, "referrals", {
    host_id: host, from_stage: "iap", to_stage: "cat", conversation_id: iap, created_at: before(base, 34, 1, 25),
    content: {
      hostOverview: "Eleanor is 63. Her father Walter, 86, fell in September, and the family keeps asking her whether he should sell the house.",
      title: "Should Dad sell the house?",
      currentConcern: "Whether her father can stay in his home of fifty-one years, and what she owes him and herself.",
      primaryThreads: ["Her father's independence", "Safety at night", "Money and the house", "Her brother's pressure to sell"],
      significantRelationships: ["Her father, Walter", "Her brother, Paul, four hours away"],
      internalTensions: ["Deciding for someone who still wants to decide for himself", "Wanting to honor him while being exhausted"],
      strengthsAndSupports: ["A care manager she trusts", "Her own persistence and care"],
      listeningCues: ["Says 'Dad is fine' when worried", "Returns to the house when the real subject is independence"],
      areasForExploration: ["What changes if he stays", "What changes if he moves", "What she can sustain"],
      hostPriorities: ["Her father's dignity", "Safety", "Not letting the decision be made in a rush"],
      desiredDirection: "A decision about the house that her father, her brother and she can each live with.",
      secondaryLossesIdentified: [
        { category: "Control", description: "Events are moving faster than she can steer them." },
        { category: "Loss of Capacity", description: "She no longer feels able to carry everything she used to carry for him." },
      ],
      governingNarratives: ["I am the one who is nearby, so it is mine to handle."],
      anchorStatements: [X.wanted],
      reflectionsThatEmerged: ["The question about the house is carrying a larger question about independence."],
      questionsWorthCarrying: ["What would safe actually look like for him?"],
      nextConversationPurpose: "To look underneath the house question at what has changed and what is being lost.",
      boundariesToProtect: ["Her father's own voice in any decision about him"],
    },
  });
  await insertOne(db, "referrals", {
    host_id: host, from_stage: "cat", to_stage: "innercompass", conversation_id: cat, created_at: before(base, 20, 3, 40),
    content: {
      hostOverview: "Eleanor sees that the house question is really about her father's independence, and that she is grieving something that has not happened yet.",
      title: "Underneath the house",
      majorUnderstandings: ["The decision is tangled with grief about her father's independence", "She needs facts about cost and coverage before she can weigh options"],
      primaryLoss: "Her father's independence and the life he built in that house.",
      significantSecondaryLosses: [
        { category: "Identity", description: "She is shifting from daughter to decision-maker." },
        { category: "Attachment / Support", description: "Her brother is far away and not carrying the weight with her." },
      ],
      keyRecognitions: ["She is anticipating a loss that has not yet happened", "A live-in aide may buy time before any sale decision"],
      identityThreads: ["The responsible daughter", "A person who cannot do everything alone"],
      activeTensions: ["Honoring her father's wishes while keeping him safe", "Her limits against her sense of duty"],
      relevantVirtues: [{ family: "love", element: "Devotion" }, { family: "wisdom", element: "Prudence" }],
      restorationTargets: ["Share the load", "Replace guessing with documents and numbers"],
      councilPerspectives: [],
      unresolvedQuestions: ["Where is his insurance policy?", "Are his legal papers current?"],
      integrationPoints: ["Overnight help and the sale can be decided separately"],
      anchorStatements: [X.alt],
      reflectionsThatEmerged: ["She does not have to decide everything at once."],
      questionsWorthCarrying: ["What can I stop carrying alone?"],
      nextConversationPurpose: "To reach a direction on the house and a next step she can take.",
      boundariesToProtect: ["Her father's right to be heard", "Her own limits"],
    },
  });
  const refIc = await insertOne(db, "referrals", {
    host_id: host, from_stage: "innercompass", to_stage: "continuity", conversation_id: ic, created_at: before(base, 7, 2, 20),
    content: {
      roomIdentity: "Eleanor's decision about her father's house",
      outcomeType: "direction_chosen",
      centralDecisionOrDirection: "Her father stays in the house only if overnight help is in place, and the decision about the sale waits until she has met the attorney.",
      rationale: "She does not yet have his documents or the cost of overnight help, and she does not want the decision made in a rush.",
      virtuesInvolved: [{ family: "wisdom", element: "Judgment" }, { family: "love", element: "Devotion" }],
      obstacles: ["Her brother wants to sell now", "She does not know whether his legal papers are current"],
      capacityConsiderations: "I do not currently have the capacity to handle his finances on top of caring for him overnight. I need others to carry some of this.",
      nextStep: "Meet with the elder-law attorney before talking with Paul about the house.",
      followUpQuestions: ["Who can carry his tax filing?", "What will overnight help cost, and what does his policy cover?"],
      anchorStatements: [X.comm],
      reflectionsThatEmerged: ["Separating the questions makes each one smaller."],
      questionsWorthCarrying: ["What does he want, in his own words?"],
      decisionsMade: ["Overnight help comes before any decision about the sale."],
      commitmentsChosen: ["Schedule the first attorney meeting", "Ask the CPA to take on the October payment"],
      whatToPreserve: "Her father's voice in the decision, and her own limits.",
      boundariesToProtect: ["Her father's dignity", "Her own capacity"],
    },
  });
  log.push("Wrote the three referrals.");

  // COORDINATION: three items and one decision, all chosen by Eleanor.
  const decision = await insertOne(db, "coordination_items", {
    host_id: host, kind: "decision", title: "Whether Dad stays in his house", category: "Family and home", delegation_state: "need_help_before_deciding", status: "open",
    related_conversation_id: ic, related_referral_id: refIc, created_at: daysAgo(35), updated_at: daysAgo(2),
  });
  await insertOne(db, "coordination_items", {
    host_id: host, kind: "item", title: "Confirm Dad's power of attorney and who can act", category: "Legal", delegation_state: "belongs_with_professional",
    professional_name: "Priya Raman", professional_role: "Elder-law attorney", status: "open", next_action: "Bring Dad's documents to the first meeting",
    due_date: dateInDays(6), related_decision_id: decision, created_at: daysAgo(20), updated_at: daysAgo(3),
  });
  await insertOne(db, "coordination_items", {
    host_id: host, kind: "item", title: "Dad's tax filing and the October estimated payment", category: "Money", delegation_state: "no_capacity_now",
    professional_name: "Tom Kessler", professional_role: "CPA", status: "waiting", waiting_on: "professional",
    waiting_on_note: "Waiting for the CPA to confirm what he needs from me", next_action: "Ask what documents Tom needs", due_date: dateInDays(12),
    related_decision_id: decision, created_at: daysAgo(18), updated_at: daysAgo(4),
  });
  await insertOne(db, "coordination_items", {
    host_id: host, kind: "item", title: "Home-care needs assessment", category: "Care", delegation_state: "someone_else_owns", assigned_to_name: "Joan Abernathy",
    assigned_to_role: "Care manager", status: "closed", closed_at: daysAgo(5), related_decision_id: decision, created_at: daysAgo(30), updated_at: daysAgo(5),
  });
  log.push("Wrote the four Coordination items.");

  // THE CONTINUITY RECORD: 7 entries plus 1 withdrawn, copied from Eleanor's own messages on their real dates.
  const entry = (entry_type: string, excerpt: string, conversation_id: string, message_id: string, extra: Row = {}): Row => ({
    host_id: host, item_id: decision, entry_type, source_kind: "conversation_message", occurred_at: new Date().toISOString(), excerpt, conversation_id, message_id, ...extra,
  });
  must("entries (first two)", await db.from("coordination_entries").insert([entry("wanted", X.wanted, iap, mWanted), entry("understood", X.understood, iap, mUnderstood)]));
  const reasoningId = await insertOne(db, "coordination_entries", entry("reasoning", X.reasoning, iap, mReasoning));
  must("entries (middle)", await db.from("coordination_entries").insert([entry("question", X.question, cat, mQuestion), entry("alternative", X.alt, cat, mAlt), entry("undecided", X.undecided, ic, mUndecided)]));
  must("entry (position changed)", await db.from("coordination_entries").insert(entry("position_changed", X.position, ic, mPosition, { host_note: "This changed after the care manager told me what overnight help depends on." })));
  must("entry (communicate)", await db.from("coordination_entries").insert(entry("communicate_to_others", X.comm, ic, mComm)));
  must("withdraw the reasoning entry", await db.from("coordination_entries").update({ withdrawn_at: new Date().toISOString() }).eq("id", reasoningId));
  log.push("Wrote the continuity record: 7 entries and 1 withdrawn.");
  return log;
}

export type DemoCheck = { name: string; ok: boolean; detail: string };

async function count(db: SupabaseClient, table: string, filters: Array<[string, unknown]>, notNull?: string): Promise<number> {
  let q = db.from(table).select("id", { count: "exact", head: true });
  for (const [col, val] of filters) q = q.eq(col, val as string);
  if (notNull) q = q.not(notNull, "is", null);
  const res = await q;
  if (res.error) throw new Error(`${table}: ${res.error.message}`);
  return res.count ?? 0;
}

/** Read-only: does the demo hold exactly the baseline? Mirrors supabase/demo/demo_baseline_check.sql. */
export async function demoBaselineChecks(): Promise<DemoCheck[]> {
  const db: SupabaseClient = createAdminClient();
  const out: DemoCheck[] = [];
  let host = "";
  let guide = "";
  try {
    const ids = await demoAccounts(db);
    host = ids.host;
    guide = ids.guide;
    out.push({ name: "both demo accounts exist, and no other account exists", ok: true, detail: "2 accounts" });
  } catch (e) {
    return [{ name: "both demo accounts exist, and no other account exists", ok: false, detail: e instanceof Error ? e.message : String(e) }];
  }
  const add = (name: string, ok: boolean, detail: string) => out.push({ name, ok, detail });
  const prof = await db.from("profiles").select("consent_at, adult_confirmed, developmental_band, role, guide_display_name").eq("id", host).maybeSingle();
  const hp = prof.data as { consent_at: string | null; adult_confirmed: boolean; developmental_band: string | null } | null;
  add("Host has consent recorded and is an adult account", !!hp && !!hp.consent_at && hp.adult_confirmed === true && hp.developmental_band === null, "profile of the demo Host");
  const gprof = await db.from("profiles").select("guide_display_name, role").eq("id", guide).maybeSingle();
  const gp = gprof.data as { guide_display_name: string | null; role: string } | null;
  const certs = await count(db, "guide_certifications", [["host_id", guide], ["standing", "active"]]);
  const auths = await count(db, "guide_platform_authorizations", [["host_id", guide], ["capability", "coordination_support"], ["status", "authorized"]]);
  add("Guide is certified, authorized for coordination support, and named Nora Castellane", certs === 1 && auths === 1 && gp?.guide_display_name === "Nora Castellane", `${certs} certification, ${auths} authorization`);
  const ents = (await count(db, "entitlements", [["host_id", host], ["source", "founder_test"], ["status", "active"]])) + (await count(db, "entitlements", [["host_id", guide], ["source", "founder_test"], ["status", "active"]]));
  add("both demo accounts carry the designated-test marker", ents === 2, `${ents} markers`);
  add("one completed Journey", (await count(db, "journeys", [["host_id", host]], "completed_at")) === 1, "journeys");
  const convs = await count(db, "conversations", [["host_id", host], ["status", "complete"]]);
  add("IAP, CAT and InnerCompass conversations, all complete", convs === 3, `${convs} complete conversations`);
  add("three referrals", (await count(db, "referrals", [["host_id", host]])) === 3, "referrals");
  const ms = await count(db, "messages", [["host_id", host]]);
  add("the Journey messages are in place (23)", ms === 23, `${ms} messages`);
  const items = await count(db, "coordination_items", [["host_id", host]]);
  const decs = await count(db, "coordination_items", [["host_id", host], ["kind", "decision"]]);
  const open = await count(db, "coordination_items", [["host_id", host], ["status", "open"]]);
  const waiting = await count(db, "coordination_items", [["host_id", host], ["status", "waiting"]]);
  const closed = await count(db, "coordination_items", [["host_id", host], ["status", "closed"]]);
  add("four Coordination items: one decision, Open x2, Waiting x1, Closed x1", items === 4 && decs === 1 && open === 2 && waiting === 1 && closed === 1, `${items} items; ${open} open, ${waiting} waiting, ${closed} closed`);
  const entries = await count(db, "coordination_entries", [["host_id", host]]);
  const withdrawn = await count(db, "coordination_entries", [["host_id", host]], "withdrawn_at");
  add("continuity record: 8 entries, 7 live, 1 withdrawn", entries === 8 && withdrawn === 1, `${entries} entries, ${withdrawn} withdrawn`);
  const early = await db.from("coordination_entries").select("occurred_at").eq("host_id", host).order("occurred_at", { ascending: true }).limit(1);
  const first = (early.data as Array<{ occurred_at: string }> | null)?.[0]?.occurred_at;
  add("the entries span several dates (earliest at least 30 days back)", !!first && Date.now() - new Date(first).getTime() > 30 * DAY, first ? first.slice(0, 10) : "none");
  const shares = await count(db, "coordination_shares", [["host_id", host]]);
  add("no share exists yet (the handoff is done live)", shares === 0, `${shares} shares`);
  const grants = await count(db, "coordination_guide_grants", [["host_id", host]]);
  const notes = await count(db, "coordination_guide_events", [["host_id", host]]);
  add("no Guide access exists yet (the grant is done live)", grants === 0 && notes === 0, `${grants} grants, ${notes} Guide notes`);
  return out;
}

/** Sends the two real demo emails (the Share With handoff and the Guide-access email) to the two synthetic demo addresses only, so deliverability can be
 *  checked in one click. The links in them point at a page that shows the normal "not available" message; no real share or grant is created. */
export async function sendDemoTestEmails(): Promise<string> {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://avaiainstitute.com").replace(/\/+$/, "");
  const when = new Date(Date.now() + 7 * DAY).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  await sendEmail({
    to: DEMO_ATTORNEY_EMAIL,
    subject: handoffInvitationSubject("Eleanor Marsh"),
    html: handoffInvitationEmailHtml({ sharedByName: "Eleanor Marsh", url: `${site}/handoff/email-test-only`, expiresOn: when }),
    context: "demo_test_handoff",
  });
  await sendEmail({
    to: DEMO_GUIDE_EMAIL,
    subject: guideCoordinationSubject("Eleanor Marsh"),
    html: guideCoordinationEmailHtml({ hostLabel: "Eleanor Marsh", url: `${site}/guided-coordination`, endsOn: when }),
    context: "demo_test_guide",
  });
  return `Sent two test emails: the handoff email to ${DEMO_ATTORNEY_EMAIL} and the Guide-access email to ${DEMO_GUIDE_EMAIL}.`;
}
