-- Retires the obsolete community_contacts guardian-name-matching access
-- path on the recognitions RLS policy. This branch let a self-registered
-- "guardian" community_contacts row see a youth's recognitions by matching
-- either an unverified guardian_of_user_id or a free-text guardian_of_name
-- string, with no identity verification. Investigation confirmed no live
-- code path anywhere in the app creates a community_contacts row (the
-- table is unreachable in production today), but the branch still existed
-- on paper. Retiring it now closes that dormant risk without waiting for a
-- future insert path to make it real, and without touching the actively
-- used guardian_consents system, which grants no content access and is
-- unrelated to this policy.
--
-- The other three community_contacts branches (teacher/school_admin,
-- business_contact, community_leader) are untouched -- they are a
-- different mechanism than the guardian one and were not in scope here.
--
-- Preserves the established rule: guardian/sponsor consent or payment does
-- NOT grant access to a youth participant's private content.

drop policy if exists "recognitions visible to observer, observed, and community contacts" on public.recognitions;

create policy "recognitions visible to observer, observed, and community contacts"
  on public.recognitions for select
  using (
    auth.uid() = observer_id
    or auth.uid() = observed_user_id
    or (
      context_type = 'school' and exists (
        select 1 from public.community_contacts cc
        where cc.user_id = auth.uid()
          and cc.contact_role in ('teacher', 'school_admin')
          and cc.school = recognitions.context_school
      )
    )
    or (
      context_type = 'community' and exists (
        select 1 from public.community_contacts cc
        where cc.user_id = auth.uid()
          and cc.contact_role = 'business_contact'
          and (
            cc.organization = recognitions.context_organization
            or cc.organization = recognitions.context_business
          )
      )
    )
    or exists (
      select 1 from public.community_contacts cc
      where cc.user_id = auth.uid()
        and cc.contact_role = 'community_leader'
        and (
          (recognitions.context_type = 'school' and cc.school = recognitions.context_school)
          or (
            recognitions.context_type = 'community'
            and (
              cc.organization = recognitions.context_organization
              or cc.organization = recognitions.context_business
            )
          )
        )
    )
  );
