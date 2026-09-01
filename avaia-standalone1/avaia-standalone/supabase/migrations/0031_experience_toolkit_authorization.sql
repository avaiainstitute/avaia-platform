-- Bring Experience Guide-read access into alignment with the current
-- Toolkit authorization system (guide_platform_authorizations, Phase D),
-- and publish the one pilot Experience that now has a real Guide-facing
-- delivery route.
--
-- Context: /toolkit itself has gated entry on guide_platform_authorizations
-- (capability = 'toolkit', status = 'authorized') since Phase D.3 -- see
-- app/toolkit/layout.tsx / isToolkitAuthorized() in lib/guide.ts. The
-- "experiences guide read" and "experience sections guide read" RLS
-- policies from migrations 0020/0021 were never updated to match; they
-- still checked the older, independent profiles.role = 'guide' column,
-- meaning a Guide authorized under the current system could reach
-- /toolkit/experiences and still be silently handed zero rows. This
-- migration replaces both checks with the same guide_platform_
-- authorizations check /toolkit's own layout already uses -- no new
-- authorization system, no invented capability. Admin-all policies on
-- both tables are untouched.
--
-- classes / experience_classes still check profiles.role = 'guide' --
-- deliberately left as-is here. This Experience has no related classes
-- (migration 0020 seeded none), so the mismatch there doesn't affect it,
-- and bringing those two policies into alignment wasn't part of what
-- this pass was asked to do.

drop policy if exists "experiences guide read" on public.experiences;
create policy "experiences guide read"
  on public.experiences for select
  using (
    status = 'published'
    and exists (
      select 1 from public.guide_platform_authorizations gpa
      where gpa.host_id = auth.uid()
        and gpa.capability = 'toolkit'
        and gpa.status = 'authorized'
    )
  );

drop policy if exists "experience sections guide read" on public.experience_sections;
create policy "experience sections guide read"
  on public.experience_sections for select
  using (
    status = 'published'
    and exists (
      select 1 from public.guide_platform_authorizations gpa
      where gpa.host_id = auth.uid()
        and gpa.capability = 'toolkit'
        and gpa.status = 'authorized'
    )
    and exists (
      select 1 from public.experiences e
      where e.id = experience_sections.experience_id and e.status = 'published'
    )
  );

-- Publish exactly one Experience -- the one this pass built a delivery
-- route for. No other draft Experience is touched; its 32 sections are
-- untouched by this migration.
update public.experiences
set status = 'published', updated_at = now()
where title = 'The Things We Lose After the Loss'
returning id, title, status, updated_at;
