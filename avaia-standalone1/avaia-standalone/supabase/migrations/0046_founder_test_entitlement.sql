-- Widens entitlements.source to allow 'founder_test' -- found live: the
-- permanent Founder Guide test/demo account (kidathart+test007@gmail.com)
-- had guide_certifications standing=active and a permanent
-- guide_platform_authorizations toolkit/guided_journey_facilitation grant,
-- but zero rows in entitlements. isMember() reads only entitlements (see
-- migration 0019's own header: profiles.membership_status is frozen,
-- unread legacy), so every member-only Host capability (self-serve
-- Unsung Heroes, CAT/InnerCompass, etc.) was correctly blocking this
-- account -- Guide/admin authorization was never a substitute for a Host
-- membership entitlement, and never should be for an ordinary account.
-- Same widen-the-enum idiom already used repeatedly on this kind of
-- column (see migrations 0034, 0045). A dedicated source value rather
-- than reusing 'sponsored' so this permanent founder-account grant reads
-- unambiguously in any future audit of this table, instead of looking
-- like a real sponsored beneficiary.

alter table public.entitlements drop constraint if exists entitlements_source_check;
alter table public.entitlements add constraint entitlements_source_check
  check (source in
    ('individual', 'supported', 'family', 'gift', 'sponsored', 'organization', 'founder_test'));

-- The grant itself: permanent (expires_at null = open-ended, same as
-- every other entitlement in this table), active, host_id looked up by
-- email rather than hardcoded so this migration is portable/replayable.
insert into public.entitlements (host_id, status, source)
select id, 'active', 'founder_test'
from auth.users
where email = 'kidathart+test007@gmail.com'
returning host_id, status, source;
