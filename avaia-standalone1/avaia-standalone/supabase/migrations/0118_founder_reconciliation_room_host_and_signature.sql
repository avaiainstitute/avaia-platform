-- 0118_founder_reconciliation_room_host_and_signature.sql
--
-- Reconciliation with the Founder decisions of 2026-10-04. Both tables touched here are
-- empty in production (0 rooms, 0 Virtue Signature entries), and every change is additive
-- or loosening, so the code that is live while this runs keeps working. Safe to run twice.
--
-- 1. ROOM OWNERSHIP. The Host always owns the Room and the Table. The Guide facilitates
--    within the Host's Room and never owns it. Until now a Room was recorded only as
--    belonging to the Guide who opened it (rooms.guide_id). Add the owner.
--      * rooms.host_participant_id : the Host whose experience establishes the Room.
--      * rooms.guide_id keeps its meaning of "the facilitating Guide's account" because the
--        Room is operated through that account (a participant has no login of their own for
--        the shared thread). It is not ownership. Access policies are unchanged in effect
--        and are only renamed so the database stops describing the Guide as the owner.
--
-- 2. VIRTUE SIGNATURE. The six "layers" came only from AI/script-generated documents saved
--    on 26-27 August 2026 (no earlier Founder source, no stated reason for six, nothing
--    connecting them to the atom). They are removed from the active implementation. The
--    column stays, nullable and unused, so nothing historical is destroyed.

-- 1. Rooms -------------------------------------------------------------------------
alter table public.rooms
  add column if not exists host_participant_id uuid references public.guide_participants (id) on delete set null;

create index if not exists rooms_host_participant_idx on public.rooms (host_participant_id);

comment on column public.rooms.host_participant_id is
  'The Host whose experience establishes this Room. The Host owns the Room and the Table; the Guide facilitates within it and never owns it. Null only for a Room opened before ownership was recorded.';
comment on column public.rooms.guide_id is
  'The FACILITATING Guide (the account the Room is operated through). Not the owner: the Room and its Table belong to the Host named by host_participant_id.';

do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('rooms',                    'rooms are guide-owner-only',                 'rooms via facilitating guide'),
      ('room_participants',        'room participants via owning guide',         'room participants via facilitating guide'),
      ('room_messages',            'room messages are guide-owner-only',         'room messages via facilitating guide'),
      ('room_private_sessions',    'room private sessions via owning guide',     'room private sessions via facilitating guide'),
      ('room_shared_items',        'room shared items via owning guide',         'room shared items via facilitating guide'),
      ('room_referrals',           'room referrals via owning guide',            'room referrals via facilitating guide'),
      ('room_invitations',         'room invitations via owning guide',          'room invitations via facilitating guide'),
      ('room_turn_requests',       'room turn requests via owning guide',        'room turn requests via facilitating guide'),
      ('room_workbook_items',      'room workbook items via owning guide',       'room workbook items via facilitating guide')
    ) as t(tbl, old_name, new_name)
  loop
    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = r.tbl and policyname = r.old_name) then
      execute format('alter policy %I on public.%I rename to %I', r.old_name, r.tbl, r.new_name);
    end if;
  end loop;
end $$;

-- 2. Virtue Signature: retire the six layers ----------------------------------------
alter table public.virtue_signature_entries alter column layer drop not null;
alter table public.virtue_signature_entries drop constraint if exists virtue_signature_entries_layer_check;

comment on column public.virtue_signature_entries.layer is
  'RETIRED 2026-10-04. The six layers were AI-generated, not a Founder source. Never read or written by the application; kept only so nothing historical is destroyed.';

-- Verification (read-only).
select
  (select count(*) from information_schema.columns where table_name = 'rooms' and column_name = 'host_participant_id') as rooms_host_column_must_be_1,
  (select count(*) from pg_policies where tablename like 'room%' and (policyname ~* 'owner|owning')) as policies_still_saying_owner_must_be_0,
  (select is_nullable from information_schema.columns where table_name = 'virtue_signature_entries' and column_name = 'layer') as signature_layer_nullable_must_be_yes,
  (select count(*) from pg_constraint where conname = 'virtue_signature_entries_layer_check') as layer_check_must_be_0;
