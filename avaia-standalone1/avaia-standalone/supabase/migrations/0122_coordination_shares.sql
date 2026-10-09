-- 0122_coordination_shares.sql
--
-- Coordination layer, Phase 3: Share With + professional handoff (Decision 0010).
--
-- A Host shares ONE item, with one named person, as a FROZEN, Host-approved copy. The recipient reads
-- that copy on a read-only page reached by a secure link. They never see the Host's live records, and
-- later changes to the Workbook, the item, an entry, a note, a position or a delegation never change a
-- share that already exists.
--
--   coordination_shares   one row per authorization. `payload` is the authoritative frozen copy the
--                         recipient sees. `entry_ids` records which entries contributed to it, but the
--                         recipient never depends on live entry content. Rows are never deleted: after
--                         a revoke or an expiry the row remains, with its frozen copy and its access log.
--
-- Integrity, enforced by the database and not only by the application:
--   * Only the server can create a share (there is no insert policy, and the Host role has no insert
--     privilege), and the insert trigger verifies the content against the real entries, so a Host's
--     browser can never forge what a professional is shown.
--   * A share can never include a withdrawn entry, and (Decision 0010) can never include a Shared Room
--     entry: outward sharing of Room words is a separate governance question, not solved here.
--   * Every frozen field is immutable for everyone. The only things that ever change are revoked_at (the
--     Host, once, never undone), email_status, and the access log (the two recipient functions).
--   * Recipients have NO table access. They reach data only through two narrow SECURITY DEFINER functions,
--     the same pattern the guardian consent link already uses. The token is hashed INSIDE the database, so
--     a leaked table cannot be turned into access, and the token itself is never stored.
--   * No IP address is stored. No delete policy exists.
--
-- Safe to run more than once.

create table if not exists public.coordination_shares (
  id                      uuid primary key default gen_random_uuid(),
  host_id                 uuid not null references auth.users (id) on delete cascade,
  item_id                 uuid not null,

  -- What the recipient is told. All typed or confirmed by the Host.
  title                   text not null check (char_length(btrim(title)) between 1 and 200),
  shared_by_name          text not null check (char_length(btrim(shared_by_name)) between 1 and 200),
  recipient_name          text not null check (char_length(btrim(recipient_name)) between 1 and 200),
  recipient_email         text not null check (char_length(recipient_email) between 3 and 320 and position('@' in recipient_email) > 1),
  recipient_role          text not null check (recipient_role in (
                            'attorney', 'cpa_accountant', 'financial_advisor', 'insurance_professional',
                            'guide', 'family_member', 'organizational_contact', 'other'
                          )),
  recipient_role_label    text check (recipient_role_label is null or char_length(btrim(recipient_role_label)) <= 100),
  purpose                 text not null check (char_length(btrim(purpose)) between 1 and 500),

  -- The frozen recipient copy, exactly as the Host approved it.
  payload                 jsonb not null,
  payload_hash            text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  payload_version         smallint not null default 1,
  -- Which entries contributed to the copy. A pointer for traceability only: no foreign key, never changes.
  entry_ids               uuid[] not null default '{}',

  -- Under whose authorization, saying what.
  authorization_statement text not null check (char_length(btrim(authorization_statement)) between 1 and 4000),
  authorized_at           timestamptz not null default now(),

  -- Lifetime: the Host chooses 1 to 30 days; the database computes the expiry from its own clock.
  valid_days              smallint not null check (valid_days between 1 and 30),
  expires_at              timestamptz not null,

  -- Only the SHA-256 of the 192-bit token. The token is never stored.
  token_hash              text not null check (token_hash ~ '^[0-9a-f]{64}$'),

  email_status            text not null default 'pending' check (email_status in ('pending', 'sent', 'failed')),
  revoked_at              timestamptz,
  first_viewed_at         timestamptz,
  last_viewed_at          timestamptz,
  view_count              integer not null default 0 check (view_count >= 0),

  constraint coordination_shares_item_fk
    foreign key (item_id, host_id) references public.coordination_items (id, host_id),
  constraint coordination_shares_role_label_required
    check (recipient_role <> 'other' or (recipient_role_label is not null and char_length(btrim(recipient_role_label)) > 0)),
  constraint coordination_shares_expiry_window
    check (expires_at = authorized_at + ((valid_days * 24) * interval '1 hour')),
  constraint coordination_shares_payload_size
    check (char_length(payload::text) <= 400000)
);

create unique index if not exists coordination_shares_token_unique
  on public.coordination_shares (token_hash);
create index if not exists coordination_shares_host_item_idx
  on public.coordination_shares (host_id, item_id, authorized_at desc);
create index if not exists coordination_shares_entry_ids_idx
  on public.coordination_shares using gin (entry_ids);

alter table public.coordination_shares enable row level security;

-- Privileges, as a second layer beneath RLS. Anonymous visitors get nothing. A signed-in Host can read
-- their own rows and set revoked_at, and nothing else. Nobody but the server can create a row, and
-- nobody can delete one.
revoke all on public.coordination_shares from anon, authenticated;
grant select on public.coordination_shares to authenticated;
grant update (revoked_at) on public.coordination_shares to authenticated;

-- Host read: their own shares, and no one else's.
do $$ begin
  create policy "coordination shares own read" on public.coordination_shares
    for select using (host_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Host revoke: their own shares. The guard trigger and the column privilege limit this to revoked_at.
-- Deliberately not limited to adult accounts: revoking must never be blocked.
do $$ begin
  create policy "coordination shares own revoke" on public.coordination_shares
    for update using (host_id = auth.uid()) with check (host_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Deliberately NO insert policy and NO delete policy.

-- Insert check: verifies what is being shared against the real records, and stamps the times.
create or replace function public.coordination_shares_check_insert() returns trigger
language plpgsql set search_path = public as $$
declare
  parent_kind text;
  e jsonb;
  eid uuid;
  stored record;
  entry_count integer := coalesce(array_length(new.entry_ids, 1), 0);
  has_content boolean;
begin
  select kind into parent_kind from public.coordination_items where id = new.item_id and host_id = new.host_id;
  if parent_kind is null then
    raise exception 'A share can only be made from one of the Host''s own items.';
  end if;
  if exists (select 1 from public.profiles p where p.id = new.host_id and p.developmental_band is not null) then
    raise exception 'Sharing is available to adult accounts in this release.';
  end if;

  if jsonb_typeof(new.payload) is distinct from 'object' or new.payload ->> 'version' is distinct from '1' then
    raise exception 'The shared copy is not in the expected form.';
  end if;
  if new.payload ->> 'title' is distinct from new.title
     or new.payload ->> 'shared_by_name' is distinct from new.shared_by_name
     or new.payload ->> 'purpose' is distinct from new.purpose then
    raise exception 'The shared copy does not match what was authorized.';
  end if;
  if jsonb_typeof(new.payload -> 'entries') is distinct from 'array' then
    raise exception 'The shared copy is not in the expected form.';
  end if;

  if entry_count <> jsonb_array_length(new.payload -> 'entries') then
    raise exception 'The shared entries do not match the entries chosen.';
  end if;
  if entry_count > 0 and parent_kind <> 'decision' then
    raise exception 'Entries can be shared only from a decision.';
  end if;
  if (select count(distinct x) from unnest(new.entry_ids) as x) <> entry_count then
    raise exception 'An entry was chosen more than once.';
  end if;

  for e in select value from jsonb_array_elements(new.payload -> 'entries') loop
    if e ? 'present_note' then
      raise exception 'An entry''s present note is never shared.';
    end if;
    eid := (e ->> 'entry_id')::uuid;
    if eid is null or not (eid = any (new.entry_ids)) then
      raise exception 'A shared entry was not among the entries chosen.';
    end if;
    select ce.host_id, ce.item_id, ce.entry_type, ce.source_kind, ce.occurred_at, ce.excerpt, ce.host_note, ce.withdrawn_at
      into stored
      from public.coordination_entries ce
     where ce.id = eid;
    if not found or stored.host_id is distinct from new.host_id or stored.item_id is distinct from new.item_id then
      raise exception 'A shared entry is not one of this decision''s entries.';
    end if;
    if stored.withdrawn_at is not null then
      raise exception 'A withdrawn entry cannot be shared.';
    end if;
    if stored.source_kind = 'room_message' then
      raise exception 'Words from a Shared Room cannot be shared outside AVAIA.';
    end if;
    if (e ->> 'excerpt') is distinct from stored.excerpt
       or (e ->> 'host_note') is distinct from stored.host_note
       or (e ->> 'entry_type') is distinct from stored.entry_type
       or (e ->> 'source_kind') is distinct from stored.source_kind
       or date_trunc('milliseconds', (e ->> 'occurred_at')::timestamptz) is distinct from date_trunc('milliseconds', stored.occurred_at) then
      raise exception 'A shared entry does not match the entry in the record.';
    end if;
  end loop;

  -- Something beyond the title must actually be shared. The Host's "how to reach me" alone is not content.
  has_content :=
       (coalesce(jsonb_typeof(new.payload -> 'facts'), '') = 'object' and new.payload -> 'facts' <> '{}'::jsonb)
    or entry_count > 0
    or coalesce(btrim(new.payload ->> 'summary'), '') <> ''
    or coalesce(btrim(new.payload ->> 'open_questions'), '') <> ''
    or coalesce(btrim(new.payload ->> 'requested_follow_up'), '') <> '';
  if not has_content then
    raise exception 'Choose something to share beyond the title.';
  end if;

  new.authorized_at := now();
  new.expires_at := now() + ((new.valid_days * 24) * interval '1 hour');
  new.email_status := 'pending';
  new.revoked_at := null;
  new.first_viewed_at := null;
  new.last_viewed_at := null;
  new.view_count := 0;
  return new;
end $$;

drop trigger if exists coordination_shares_check_insert on public.coordination_shares;
create trigger coordination_shares_check_insert before insert on public.coordination_shares
  for each row execute function public.coordination_shares_check_insert();

-- Guard: a frozen copy is never changed. Only revoked_at, email_status and the access log can move.
create or replace function public.coordination_shares_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.id is distinct from old.id
     or new.host_id is distinct from old.host_id
     or new.item_id is distinct from old.item_id
     or new.title is distinct from old.title
     or new.shared_by_name is distinct from old.shared_by_name
     or new.recipient_name is distinct from old.recipient_name
     or new.recipient_email is distinct from old.recipient_email
     or new.recipient_role is distinct from old.recipient_role
     or new.recipient_role_label is distinct from old.recipient_role_label
     or new.purpose is distinct from old.purpose
     or new.payload is distinct from old.payload
     or new.payload_hash is distinct from old.payload_hash
     or new.payload_version is distinct from old.payload_version
     or new.entry_ids is distinct from old.entry_ids
     or new.authorization_statement is distinct from old.authorization_statement
     or new.authorized_at is distinct from old.authorized_at
     or new.valid_days is distinct from old.valid_days
     or new.expires_at is distinct from old.expires_at
     or new.token_hash is distinct from old.token_hash then
    raise exception 'A shared copy cannot be changed after it is authorized.';
  end if;

  -- A signed-in Host (the authenticated role) can change nothing but revoked_at.
  if current_user in ('authenticated', 'anon') then
    if new.email_status is distinct from old.email_status
       or new.first_viewed_at is distinct from old.first_viewed_at
       or new.last_viewed_at is distinct from old.last_viewed_at
       or new.view_count is distinct from old.view_count then
      raise exception 'A shared copy cannot be changed after it is authorized.';
    end if;
  else
    if new.view_count < old.view_count then
      raise exception 'The view count cannot go down.';
    end if;
    if old.email_status <> 'pending' and new.email_status = 'pending' then
      raise exception 'The email status cannot go back to pending.';
    end if;
    if old.first_viewed_at is not null then
      new.first_viewed_at := old.first_viewed_at;
    end if;
  end if;

  -- Revocation is stamped once by the database and can never be undone.
  if old.revoked_at is not null then
    new.revoked_at := old.revoked_at;
  elsif new.revoked_at is not null then
    new.revoked_at := now();
  end if;

  return new;
end $$;

drop trigger if exists coordination_shares_guard on public.coordination_shares;
create trigger coordination_shares_guard before update on public.coordination_shares
  for each row execute function public.coordination_shares_guard();

-- Recipient access: two narrow functions, following the guardian-consent pattern. The token is hashed
-- inside the database. A missing, expired or revoked share returns exactly the same thing: null.

-- Landing page only: who shared it and when it ends. Does not record a view and returns no content.
create or replace function public.peek_handoff(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s record;
begin
  if p_token is null or char_length(p_token) < 20 or char_length(p_token) > 200 then
    return null;
  end if;
  select cs.shared_by_name, cs.expires_at
    into s
    from public.coordination_shares cs
   where cs.token_hash = encode(sha256(convert_to(p_token, 'utf8')), 'hex')
     and cs.revoked_at is null
     and cs.expires_at > now();
  if not found then
    return null;
  end if;
  return jsonb_build_object('shared_by_name', s.shared_by_name, 'expires_at', s.expires_at);
end $$;

-- The View step: records the first actual view and returns the frozen copy.
create or replace function public.open_handoff(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s record;
begin
  if p_token is null or char_length(p_token) < 20 or char_length(p_token) > 200 then
    return null;
  end if;
  update public.coordination_shares cs
     set first_viewed_at = coalesce(cs.first_viewed_at, now()),
         last_viewed_at = now(),
         view_count = cs.view_count + 1
   where cs.token_hash = encode(sha256(convert_to(p_token, 'utf8')), 'hex')
     and cs.revoked_at is null
     and cs.expires_at > now()
  returning cs.payload, cs.shared_by_name, cs.authorized_at, cs.expires_at
    into s;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'payload', s.payload,
    'shared_by_name', s.shared_by_name,
    'authorized_at', s.authorized_at,
    'expires_at', s.expires_at
  );
end $$;

revoke all on function public.peek_handoff(text) from public, anon, authenticated;
grant execute on function public.peek_handoff(text) to anon, authenticated;
revoke all on function public.open_handoff(text) from public, anon, authenticated;
grant execute on function public.open_handoff(text) to anon, authenticated;

comment on table public.coordination_shares is
  'A frozen, Host-authorized share of one coordination item with one named person (Decision 0010). payload is the authoritative copy the recipient sees; later changes to the Workbook never change it. Created only by the server and verified here; never deleted; recipients have no table access, only peek_handoff and open_handoff; no IP address is stored.';
comment on column public.coordination_shares.payload is
  'The exact content the Host approved, frozen at authorization. Never changes.';
comment on column public.coordination_shares.entry_ids is
  'Which continuity entries contributed to the frozen copy. A traceability pointer only (no foreign key); the recipient never depends on live entry content.';
comment on column public.coordination_shares.token_hash is
  'SHA-256 of the 192-bit link token, computed inside the database when the link is opened. The token itself is never stored.';
comment on column public.coordination_shares.valid_days is
  'The Host-chosen lifetime, 1 to 30 days. expires_at is computed by the database from authorized_at. There is no extension: to continue, the Host makes a new share.';
