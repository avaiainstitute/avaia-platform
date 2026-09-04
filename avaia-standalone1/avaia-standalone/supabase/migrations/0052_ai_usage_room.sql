-- Widens ai_usage_events.feature to allow 'room_conversation' and
-- 'room_referral' -- the Shared Room's own conversation turns and closing
-- record (lib/engine/room.ts). Same widen-the-enum idiom already used
-- repeatedly on this column (see migrations 0034, 0045). Purely additive:
-- no existing row's feature value is affected, and every existing feature
-- value remains valid. stage stays untouched (nullable already, and Room
-- calls pass stage: null -- a Room is not one of the three Journey stages).

alter table public.ai_usage_events drop constraint if exists ai_usage_events_feature_check;
alter table public.ai_usage_events add constraint ai_usage_events_feature_check
  check (feature in (
    'iap_conversation', 'cat_conversation', 'innercompass_conversation',
    'iap_referral', 'cat_referral', 'innercompass_referral',
    'cat_opening', 'innercompass_opening',
    'unsung_heroes_recognition', 'unsung_heroes_conversation',
    'chemistry_virtue_formula', 'transcript_cleanup',
    'preparation_snapshot', 'preparation_chat',
    'room_conversation', 'room_referral'
  ));
