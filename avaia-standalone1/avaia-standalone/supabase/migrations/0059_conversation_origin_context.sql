-- Carries structured origin context (Chemistry element, or a View From
-- Above class) into a brand-new IAP conversation -- source, label,
-- Virtue Family, and canonical definition, resolved server-side from
-- the existing canonical data (lib/virtues.ts / lib/view-from-above.ts)
-- and never trusted from client-supplied free text. Read-only display/
-- prompt context; never used for authorization, never touches the
-- existing membership entitlement gate (stage !== 'iap' && !isMember),
-- which is completely unmodified by this column's existence.
alter table public.conversations
  add column if not exists origin_context jsonb;

-- Same widen-the-enum idiom as 0034/0045/0052 -- adds 'iap_origin_opening'
-- for generateIapOriginOpening's own usage recording.
alter table public.ai_usage_events drop constraint if exists ai_usage_events_feature_check;
alter table public.ai_usage_events add constraint ai_usage_events_feature_check
  check (feature in (
    'iap_conversation', 'cat_conversation', 'innercompass_conversation',
    'iap_referral', 'cat_referral', 'innercompass_referral',
    'cat_opening', 'innercompass_opening', 'iap_origin_opening',
    'unsung_heroes_recognition', 'unsung_heroes_conversation',
    'chemistry_virtue_formula', 'transcript_cleanup',
    'preparation_snapshot', 'preparation_chat',
    'room_conversation', 'room_referral'
  ));
