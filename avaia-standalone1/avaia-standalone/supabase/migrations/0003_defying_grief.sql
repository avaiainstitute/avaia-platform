-- Defying Grief — program tag only. Run once against the live database
-- (Supabase SQL editor), after 0001/0002. Safe to re-run: the whole clause
-- is skipped if the column exists.
--
-- This is the ONLY new backend surface Defying Grief needs. It does not
-- introduce a parallel continuity system: Room Identity, referral content,
-- and stage-completion state all continue to live entirely in the existing
-- conversations/referrals tables (referrals.content.title on IAP/CAT,
-- referrals.content.roomIdentity on InnerCompass, referrals.conversation_id
-- for linking). This column exists only so Defying Grief's dashboard can
-- scope its queries to "this participant's conversations that belong to
-- this program" — it is a label, not a tracking mechanism.

alter table public.conversations
  add column if not exists program text not null default 'general'
    check (program in ('general', 'defying-grief'));
