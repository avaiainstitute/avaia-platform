-- Referral-generation convergence: prevents two near-simultaneous
-- completion signals for the same conversation (a typed request and a
-- button click, or a double-submit) from producing two referral rows and
-- two next-stage conversations. generateReferral() catches the resulting
-- unique-violation and treats it as an already-completed success rather
-- than an error -- see lib/engine/referral-generation.ts.
--
-- Additive and safe to run more than once: guarded so it does nothing if
-- the constraint already exists.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'referrals_conversation_id_unique'
  ) then
    alter table public.referrals
      add constraint referrals_conversation_id_unique unique (conversation_id);
  end if;
end $$;
