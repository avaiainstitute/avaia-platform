import { STAGE_LABEL } from "@/lib/engine/conversation";
import type { Stage } from "@/lib/engine/prompts";
import {
  COORDINATION_KIND_LABEL,
  COORDINATION_KINDS,
  DELEGATION_LABEL,
  DELEGATION_STATES,
  LIMITS,
  STATUS_LABEL,
  COORDINATION_STATUSES,
  WAITING_ON_LABEL,
  WAITING_ON_VALUES,
  type CoordinationItem,
} from "@/lib/coordination";
import type { PointerChoices } from "@/lib/ops/coordination";

// The fields shared by "new" and "edit" on the Coordination pages. Plain form fields, no client
// state. Every choice here is the Host's own; nothing is pre-selected on the Host's behalf except
// what they already saved, or the title and kind of an item they chose to add from their own
// decision or commitment (and those can be changed before saving).

const input =
  "w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal";
const option = "bg-[#05060b] text-ink";

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
const stageName = (s: string) => STAGE_LABEL[s as Stage] ?? s;

export type FieldDefaults = Partial<CoordinationItem> & {
  /** A pointer the Host is starting from (Add to Coordination), kept in the list even when it is
   *  older than the most recent choices offered. */
  seedReferralId?: string | null;
  seedConversationId?: string | null;
};

export default function CoordinationFields({
  defaults,
  choices,
  decisions,
  idPrefix,
}: {
  defaults?: FieldDefaults;
  choices: PointerChoices;
  /** The Host's other decision items, so an item can relate to one. */
  decisions: { id: string; title: string }[];
  idPrefix: string;
}) {
  const d = defaults ?? {};
  const referralId = d.related_referral_id ?? d.seedReferralId ?? "";
  const conversationId = d.related_conversation_id ?? d.seedConversationId ?? "";
  const id = (n: string) => `${idPrefix}-${n}`;

  const conversationOptions = [...choices.conversations];
  if (conversationId && !conversationOptions.some((c) => c.id === conversationId)) {
    conversationOptions.push({ id: conversationId, stage: "", created_at: "" });
  }
  const referralOptions = [...choices.referrals];
  if (referralId && !referralOptions.some((r) => r.id === referralId)) {
    referralOptions.push({ id: referralId, from_stage: "", created_at: "" });
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="label mb-2 block" htmlFor={id("kind")}>
          What is this?
        </label>
        <select id={id("kind")} name="kind" defaultValue={d.kind ?? "item"} className={input}>
          {COORDINATION_KINDS.map((k) => (
            <option key={k} value={k} className={option}>
              {COORDINATION_KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label mb-2 block" htmlFor={id("title")}>
          Title
        </label>
        <input id={id("title")} name="title" required maxLength={LIMITS.title} defaultValue={d.title ?? ""} className={input} />
      </div>

      <div>
        <label className="label mb-2 block" htmlFor={id("category")}>
          Category (your own word, optional)
        </label>
        <input id={id("category")} name="category" maxLength={LIMITS.category} defaultValue={d.category ?? ""} className={input} />
      </div>

      <div>
        <label className="label mb-2 block" htmlFor={id("delegation")}>
          Who carries this?
        </label>
        <select id={id("delegation")} name="delegation_state" defaultValue={d.delegation_state ?? ""} className={input}>
          <option value="" className={option}>
            I haven&rsquo;t chosen yet
          </option>
          {DELEGATION_STATES.map((s) => (
            <option key={s} value={s} className={option}>
              {DELEGATION_LABEL[s]}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted">Your choice only. AVAIA never fills this in for you.</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label mb-2 block" htmlFor={id("assigned-name")}>
            Person helping (optional)
          </label>
          <input id={id("assigned-name")} name="assigned_to_name" maxLength={LIMITS.assignedName} defaultValue={d.assigned_to_name ?? ""} className={input} />
        </div>
        <div>
          <label className="label mb-2 block" htmlFor={id("assigned-role")}>
            Their role (optional)
          </label>
          <input id={id("assigned-role")} name="assigned_to_role" maxLength={LIMITS.assignedRole} defaultValue={d.assigned_to_role ?? ""} className={input} />
        </div>
        <div>
          <label className="label mb-2 block" htmlFor={id("pro-name")}>
            Professional involved (optional)
          </label>
          <input id={id("pro-name")} name="professional_name" maxLength={LIMITS.professionalName} defaultValue={d.professional_name ?? ""} className={input} />
        </div>
        <div>
          <label className="label mb-2 block" htmlFor={id("pro-role")}>
            Their role (optional)
          </label>
          <input id={id("pro-role")} name="professional_role" maxLength={LIMITS.professionalRole} defaultValue={d.professional_role ?? ""} className={input} />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label mb-2 block" htmlFor={id("status")}>
            Status
          </label>
          <select id={id("status")} name="status" defaultValue={d.status ?? "open"} className={input}>
            {COORDINATION_STATUSES.map((s) => (
              <option key={s} value={s} className={option}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label mb-2 block" htmlFor={id("waiting-on")}>
            If Waiting, waiting on
          </label>
          <select id={id("waiting-on")} name="waiting_on" defaultValue={d.waiting_on ?? ""} className={input}>
            <option value="" className={option}>
              Not waiting
            </option>
            {WAITING_ON_VALUES.map((w) => (
              <option key={w} value={w} className={option}>
                {WAITING_ON_LABEL[w]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="label mb-2 block" htmlFor={id("waiting-note")}>
          Who or what, specifically (optional, used when Waiting)
        </label>
        <input id={id("waiting-note")} name="waiting_on_note" maxLength={LIMITS.waitingNote} defaultValue={d.waiting_on_note ?? ""} className={input} />
      </div>

      <div className="grid gap-5 sm:grid-cols-[1fr_12rem]">
        <div>
          <label className="label mb-2 block" htmlFor={id("next")}>
            Next action (optional)
          </label>
          <input id={id("next")} name="next_action" maxLength={LIMITS.nextAction} defaultValue={d.next_action ?? ""} className={input} />
        </div>
        <div>
          <label className="label mb-2 block" htmlFor={id("due")}>
            Due or follow up (optional)
          </label>
          <input id={id("due")} name="due_date" type="date" defaultValue={d.due_date ?? ""} className={input} />
        </div>
      </div>

      {decisions.length > 0 && (
        <div>
          <label className="label mb-2 block" htmlFor={id("decision")}>
            Relates to a decision (optional)
          </label>
          <select id={id("decision")} name="related_decision_id" defaultValue={d.related_decision_id ?? ""} className={input}>
            <option value="" className={option}>
              None
            </option>
            {decisions.map((x) => (
              <option key={x.id} value={x.id} className={option}>
                {x.title}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label mb-2 block" htmlFor={id("conversation")}>
            Related conversation (optional)
          </label>
          <select id={id("conversation")} name="related_conversation_id" defaultValue={conversationId} className={input}>
            <option value="" className={option}>
              None
            </option>
            {conversationOptions.map((c) => (
              <option key={c.id} value={c.id} className={option}>
                {c.stage ? `${stageName(c.stage)}, ${fmt(c.created_at)}` : "Linked conversation"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label mb-2 block" htmlFor={id("referral")}>
            Related referral (optional)
          </label>
          <select id={id("referral")} name="related_referral_id" defaultValue={referralId} className={input}>
            <option value="" className={option}>
              None
            </option>
            {referralOptions.map((r) => (
              <option key={r.id} value={r.id} className={option}>
                {r.from_stage ? `${stageName(r.from_stage)} referral, ${fmt(r.created_at)}` : "Linked referral"}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label mb-2 block" htmlFor={id("room")}>
          Related Shared Room (a note, optional)
        </label>
        <input id={id("room")} name="related_room_label" maxLength={LIMITS.roomLabel} defaultValue={d.related_room_label ?? ""} className={input} />
        <p className="mt-1 text-xs text-muted">Just a label you type. It doesn&rsquo;t link to or change anything in a Room.</p>
      </div>
    </div>
  );
}
