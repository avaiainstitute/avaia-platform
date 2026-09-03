-- Widens ai_usage_events.feature to allow 'preparation_chat' -- the
-- interactive Preparation workspace (lib/engine/preparation.ts's
-- generatePreparationChatReply), built during the admin/Guide usability
-- pass to close the gap between the static Snapshot and what the original
-- Preparation capability was meant to support. Same widen-the-enum idiom
-- already used repeatedly on this column (see migration 0034). Purely
-- additive: no existing row's feature value is affected, and every
-- existing feature value remains valid.

alter table public.ai_usage_events drop constraint if exists ai_usage_events_feature_check;
alter table public.ai_usage_events add constraint ai_usage_events_feature_check
  check (feature in (
    'iap_conversation', 'cat_conversation', 'innercompass_conversation',
    'iap_referral', 'cat_referral', 'innercompass_referral',
    'cat_opening', 'innercompass_opening',
    'unsung_heroes_recognition', 'unsung_heroes_conversation',
    'chemistry_virtue_formula', 'transcript_cleanup',
    'preparation_snapshot', 'preparation_chat'
  ));
