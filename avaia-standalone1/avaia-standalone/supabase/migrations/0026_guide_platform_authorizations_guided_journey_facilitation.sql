-- Widens guide_platform_authorizations.capability to also allow
-- 'guided_journey_facilitation' (Phase E.1). Purely additive: one CHECK
-- constraint replaced with a wider version, zero other schema changes.
--
-- ============================================================================
-- IMPORTANT -- THIS CAPABILITY DOES NOT GRANT ACCESS TO ANY HOST DATA.
--
-- guided_journey_facilitation answers only: "does AVAIA currently authorize
-- this Certified AVAIA Guide to perform real Guided Journey facilitation
-- when a Host separately grants access to a specific Journey?" It is the
-- AVAIA-side half of a two-sided requirement -- the Host-side half (a
-- Host explicitly, scopedly, revocably inviting a specific Guide into a
-- specific Journey) is a later, separately-approved phase (guide_journey_
-- access, not built here). This migration does not touch, read, or write
-- any Journey, conversation, message, referral, or Workbook data, and does
-- not create any new access to it. Granting this authorization to a Guide
-- changes nothing about what any Host can currently see or has currently
-- shared.
--
-- IMPORTANT -- INDEPENDENT OF TOOLKIT AUTHORIZATION.
--
-- 'toolkit' and 'guided_journey_facilitation' are two separate capability
-- rows. Holding one implies nothing about the other -- a Guide may be
-- Toolkit-authorized without Guided Journey Facilitation authorization, or
-- vice versa (though in practice Guided Journey Facilitation without
-- Toolkit access would be unusual, nothing in this schema requires or
-- enforces that relationship). Both remain gated on the same underlying
-- requirement established in Phase D: an existing guide_certifications row
-- with standing = 'active', re-verified fresh at grant time by the admin
-- action -- never inferred from profiles.role, profiles.guide_certified_at,
-- candidate status, or a certification decision alone.
-- ============================================================================

alter table public.guide_platform_authorizations
  drop constraint if exists guide_platform_authorizations_capability_check;
alter table public.guide_platform_authorizations
  add constraint guide_platform_authorizations_capability_check
    check (capability in ('toolkit', 'guided_journey_facilitation'));
