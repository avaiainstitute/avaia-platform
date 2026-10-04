-- 0115: Guide access to the Library follows certification and authorization,
-- the same rule the Toolkit already uses (lib/guide.ts isToolkitAuthorized),
-- instead of the profile role label.
--
-- The "library entries guide read" rule (0012) granted published-entry access to
-- any account whose profiles.role is 'guide'. Nothing in AVAIA sets that role when
-- a Guide is certified, so a newly certified Guide with no paid membership saw only
-- the public entries in the Toolkit's own Library, and an account with the role label
-- but no certification would have seen everything. Now a Guide reads the published
-- Library exactly while they hold an ACTIVE certification AND their latest Toolkit
-- authorization is 'authorized'. A lapsed, paused or revoked Guide loses it with the
-- Toolkit. Members and the public are unaffected (their own rules are untouched).
--
-- Verified before applying by a self-rolling-back test: a certified, Toolkit-
-- authorized Guide with no membership saw 25 entries before and 59 after. No account
-- held the 'guide' role, so no one's current access is removed. Safe to run more than once.

drop policy if exists "library entries guide read" on public.library_entries;
create policy "library entries guide read" on public.library_entries for select using (
  status = 'published'
  and exists (select 1 from public.guide_certifications gc where gc.host_id = auth.uid() and gc.standing = 'active')
  and exists (
    select 1 from public.guide_platform_authorizations a
    where a.host_id = auth.uid() and a.capability = 'toolkit' and a.status = 'authorized'
      and not exists (
        select 1 from public.guide_platform_authorizations b
        where b.host_id = a.host_id and b.capability = a.capability
          and coalesce(b.status_changed_at, b.granted_at) > coalesce(a.status_changed_at, a.granted_at)
      )
  )
);

-- Verification (read-only): the rule no longer mentions the role label.
select policyname, qual not like '%''guide''%' as no_longer_depends_on_role_label
from pg_policies where schemaname = 'public' and tablename = 'library_entries' and policyname = 'library entries guide read';
