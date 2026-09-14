-- Automation audit finding #3.1: the guide-operations cron only ever
-- watched the first joint of the certification pipeline (payment ->
-- decision). This widens the same reminder table to also cover the two
-- later joints: a 'certified' decision awaiting the actual
-- guide_certifications grant, and an active certification awaiting Toolkit
-- authorization. No new table, no new architecture -- the exact same
-- idempotency/cooldown mechanism from 0064 is reused for both.
--
-- All three of these joints are still purely mechanical waiting-state
-- detection, per guide-operations.ts's own header comment: this never
-- evaluates a candidate's competency or invents a certification
-- requirement, and recording a reminder never grants a certification or
-- Toolkit authorization -- both remain the deliberate, separate,
-- human-performed admin actions they already are.

alter table public.guide_candidate_reminders
  drop constraint if exists guide_candidate_reminders_reminder_type_check;

alter table public.guide_candidate_reminders
  add constraint guide_candidate_reminders_reminder_type_check
  check (reminder_type in (
    'candidacy_stalled', 'paid_awaiting_decision',
    'certified_awaiting_grant', 'certified_awaiting_toolkit_auth'
  ));

alter table public.guide_candidate_reminders
  drop constraint if exists guide_candidate_reminders_key_matches_type;

alter table public.guide_candidate_reminders
  add constraint guide_candidate_reminders_key_matches_type check (
    (reminder_type = 'candidacy_stalled' and candidate_id is not null)
    or
    (reminder_type = 'paid_awaiting_decision' and host_id is not null)
    or
    (reminder_type = 'certified_awaiting_grant' and candidate_id is not null)
    or
    (reminder_type = 'certified_awaiting_toolkit_auth' and candidate_id is not null)
  );
