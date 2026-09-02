-- Closes the classes/experience_classes authorization drift flagged but
-- deliberately left untouched by 0031_experience_toolkit_authorization.sql
-- (see that migration's own comment: "classes / experience_classes still
-- check profiles.role = 'guide' -- deliberately left as-is here... wasn't
-- part of what this pass was asked to do").
--
-- Same drift, same fix, same precedent: these two "guide read" policies
-- still check the older, independent profiles.role = 'guide' column
-- instead of the current Toolkit authorization system
-- (guide_platform_authorizations, capability='toolkit', status='authorized')
-- that /toolkit's own layout gate (isToolkitAuthorized(), lib/guide.ts)
-- has used since Phase D.3. A Guide authorized under the current system
-- but never granted the legacy role value could reach /toolkit/classes or
-- an Experience's related classes and be silently handed zero rows.
--
-- Confirmed via live pg_policy read before writing this migration: both
-- policies still read exactly as 0020_experiences_classes.sql defined
-- them -- no other drift exists on either table. Both "admin all" policies
-- are untouched; only the two "guide read" (SELECT-only) policies change.
-- Capability granted is identical -- same intended SELECT-only Guide read
-- of published classes / experience-class associations -- only the
-- authorization signal changes.

drop policy if exists "classes guide read" on public.classes;
create policy "classes guide read"
  on public.classes for select
  using (
    status = 'published'
    and exists (
      select 1 from public.guide_platform_authorizations gpa
      where gpa.host_id = auth.uid()
        and gpa.capability = 'toolkit'
        and gpa.status = 'authorized'
    )
  );

drop policy if exists "experience classes guide read" on public.experience_classes;
create policy "experience classes guide read"
  on public.experience_classes for select
  using (
    exists (
      select 1 from public.guide_platform_authorizations gpa
      where gpa.host_id = auth.uid()
        and gpa.capability = 'toolkit'
        and gpa.status = 'authorized'
    )
  );
