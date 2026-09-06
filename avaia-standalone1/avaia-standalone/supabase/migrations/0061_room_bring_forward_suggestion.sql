-- Adds the 'room_bring_forward_suggestion' feature tag for
-- suggestBringForward (lib/engine/room.ts) -- the missing piece found in a
-- 2026-09-05 audit of the Shared Room private<->shared boundary: a
-- participant's private processing had no way to help them find words for
-- what to bring back, only a blank textarea. Same widen-the-enum idiom as
-- 0034/0045/0052/0059/0060.
alter table public.ai_usage_events drop constraint if exists ai_usage_events_feature_check;
alter table public.ai_usage_events add constraint ai_usage_events_feature_check
  check (feature in (
    'iap_conversation', 'cat_conversation', 'innercompass_conversation',
    'iap_referral', 'cat_referral', 'innercompass_referral',
    'cat_opening', 'innercompass_opening', 'iap_origin_opening',
    'unsung_heroes_recognition', 'unsung_heroes_conversation',
    'chemistry_virtue_formula', 'transcript_cleanup',
    'preparation_snapshot', 'preparation_chat',
    'room_conversation', 'room_referral', 'room_bring_forward_suggestion',
    'unsaid_conversation'
  ));
