-- Aligns library_entries' "member read" RLS policy with the entitlements-
-- based membership architecture (0019_entitlements.sql) already governing
-- every other membership check in this app.
--
-- This is NOT a live production fix. The AVAIA Living Library Production
-- Readiness audit (2026-09) found the running database's policy had
-- already been corrected to check entitlements at some point after
-- 0012_guide_toolkit_expansion.sql shipped -- but that correction was
-- never captured in a migration file, so source control still showed the
-- stale profiles.membership_status check. This migration exists purely to
-- make source control match what production has already verified as
-- correct (confirmed live, both directions, via controlled test
-- accounts), so a future schema rebuild from these migrations alone
-- reproduces the correct policy instead of silently regressing.
--
-- Narrow scope: every other library_* table's live RLS was compared
-- against its own migration during this same audit and matched exactly.
-- This is the only policy anywhere in the Library schema with any drift.

drop policy if exists "library entries member read" on public.library_entries;

create policy "library entries member read"
  on public.library_entries for select
  using (
    status = 'published' and visibility = 'member'
    and exists (
      select 1 from public.entitlements e
      where e.host_id = auth.uid()
        and e.status = 'active'
        and (e.expires_at is null or e.expires_at > now())
    )
  );
