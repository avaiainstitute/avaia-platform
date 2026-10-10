-- AVAIA DEMO: schema parity check. READ-ONLY. Run in the SQL editor of the project you want to check.
-- Generated from lib/ops/expected-schema.generated.ts at repository commit d71233e. Changes nothing.
-- It is also safe to run in Production first: Production should return PASS on every row, which proves the check itself.
-- Reads: expected tables (109), expected columns (0), expected database functions (11), and whether
-- row level security is on for every table in the public schema. It reads the catalog only, never a row of data.
with
expected_tables(t) as (values ('ai_usage_events'),('avaia_content_items'),('avaia_experience_inquiries'),('avaia_experience_prospects'),('avaia_speaking_opportunities'),('certification_applications'),('certification_candidate_progress'),('certification_candidate_reflections'),('certification_companion_checkins'),('certification_companion_conversations'),('certification_companion_escalations'),('certification_companion_messages'),('certification_curriculum_items'),('certification_gate_evaluations'),('certification_lab_evaluations'),('certification_practice_messages'),('certification_practice_sessions'),('certification_practicum_evaluations'),('classes'),('contact_submissions'),('conversation_integrity_flags'),('conversations'),('coordination_entries'),('coordination_guide_events'),('coordination_guide_grants'),('coordination_guide_scope'),('coordination_items'),('coordination_shares'),('crisis_events'),('cron_runs'),('email_send_failures'),('entitlements'),('experience_classes'),('experience_sections'),('experiences'),('family_invite_reminders'),('family_members'),('family_memberships'),('founder_notes'),('guardian_consent_reminders'),('guardian_consents'),('guide_candidate_evidence'),('guide_candidate_history'),('guide_candidates'),('guide_ce_categories'),('guide_ce_credits'),('guide_certification_decisions'),('guide_certification_fee_payments'),('guide_certification_payments'),('guide_certification_policy'),('guide_certification_renewal_reminders'),('guide_certifications'),('guide_item_offers'),('guide_journey_access'),('guide_participants'),('guide_platform_authorizations'),('guide_sessions'),('host_onboarding_reminders'),('journal_entries'),('journeys'),('kept_items'),('library_concept_relations'),('library_concepts'),('library_entries'),('library_entry_concepts'),('library_entry_questions'),('library_host_entries'),('library_passage_concepts'),('library_passages'),('library_people'),('library_question_concepts'),('library_questions'),('library_source_versions'),('library_works'),('messages'),('oauth_access_tokens'),('oauth_authorization_codes'),('organization_admin_actions'),('organization_admins'),('organization_guides'),('organizations'),('profiles'),('program_authorization_enrollments'),('program_authorization_evidence'),('program_authorization_history'),('program_authorizations'),('recognitions'),('referrals'),('room_invitations'),('room_messages'),('room_participants'),('room_private_access_tokens'),('room_private_sessions'),('room_referrals'),('room_shared_items'),('room_turn_requests'),('room_workbook_items'),('rooms'),('shared_access'),('shared_access_invites'),('system_check_results'),('toolkit_support_items'),('unsaid_conversations'),('unsaid_messages'),('unsung_heroes_conversations'),('unsung_heroes_messages'),('virtue_signature_entries'),('youth_program_participants'),('youth_programs')),
expected_cols(t, c) as (values ('contact_submissions','follow_up_needed'),('contact_submissions','needs_dorian'),('contact_submissions','resolved_at'),('contact_submissions','status'),('conversations','journey_id'),('conversations','origin_context'),('conversations','program'),('conversations','youth_program'),('crisis_events','flagged_by'),('crisis_events','guide_participant_id'),('crisis_events','note'),('entitlements','family_membership_id'),('founder_notes','linked_content_item_id'),('guardian_consents','assent_confirmed_at'),('guardian_consents','confirmed_at'),('guardian_consents','confirmed_ip'),('guardian_consents','consent_token'),('guardian_consents','token_created_at'),('guardian_consents','verification_method'),('guide_candidates','ready_for_review'),('guide_candidates','ready_for_review_marked_at'),('guide_candidates','ready_for_review_marked_by'),('guide_candidates','ready_for_review_notes'),('guide_certifications','cycle_ends_at'),('guide_certifications','cycle_started_at'),('guide_certifications','inactive_since'),('guide_certifications','last_renewed_at'),('guide_certifications','recertification_required_at'),('guide_participants','developmental_band'),('guide_sessions','class_context'),('guide_sessions','program'),('guide_sessions','session_context'),('guide_sessions','youth_program'),('journeys','youth_program'),('pink_contact_submissions','acknowledged_at'),('pink_contact_submissions','resolved_at'),('pink_donor_sponsor_records','dorian_action_needed'),('pink_donor_sponsor_records','next_follow_up_at'),('pink_participation_interest','acknowledged_at'),('pink_participation_interest','resolved_at'),('pink_partnerships','legacy_review_item_id'),('profiles','developmental_band'),('profiles','guide_certified_at'),('profiles','guide_display_name'),('profiles','marketing_consent'),('profiles','marketing_consent_at'),('profiles','marketing_consent_source'),('profiles','membership_status'),('profiles','role'),('recognitions','acknowledgment'),('recognitions','contribution'),('recognitions','conversation_id'),('referrals','conversation_id'),('room_participants','last_seen_at'),('rooms','floor_participant_id'),('rooms','host_participant_id')),
expected_rpcs(f) as (values ('avaia_schema_snapshot'),('confirm_pending_consent'),('get_guide_display_name'),('get_pending_consent_by_token'),('guide_coordination_host_view'),('guide_coordination_hosts'),('list_eligible_coordination_guides'),('list_eligible_guided_journey_guides'),('open_handoff'),('peek_handoff'),('set_guide_display_name')),
missing_tables as (select t from expected_tables where to_regclass('public.' || t) is null),
missing_cols as (
  select e.t, e.c from expected_cols e
  where not exists (select 1 from information_schema.columns k where k.table_schema = 'public' and k.table_name = e.t and k.column_name = e.c)
),
missing_rpcs as (
  select f from expected_rpcs where not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = f)
),
no_rls as (
  select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
),
results as (
  select 1 as ord, 'expected tables all exist' as check_name,
         case when (select count(*) from missing_tables) = 0 then 'PASS' else 'FAIL' end as result,
         (select count(*) from expected_tables) || ' expected; missing: ' || coalesce((select string_agg(t, ', ' order by t) from missing_tables), 'none') as detail
  union all
  select 2, 'expected columns all exist',
         case when (select count(*) from missing_cols) = 0 then 'PASS' else 'FAIL' end,
         (select count(*) from expected_cols) || ' expected; missing: ' || coalesce((select string_agg(t || '.' || c, ', ' order by t, c) from missing_cols), 'none')
  union all
  select 3, 'expected database functions all exist',
         case when (select count(*) from missing_rpcs) = 0 then 'PASS' else 'FAIL' end,
         (select count(*) from expected_rpcs) || ' expected; missing: ' || coalesce((select string_agg(f, ', ' order by f) from missing_rpcs), 'none')
  union all
  select 4, 'row level security is on for every public table',
         case when (select count(*) from no_rls) = 0 then 'PASS' else 'FAIL' end,
         (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r') || ' public tables; without RLS: ' || coalesce((select string_agg(relname, ', ' order by relname) from no_rls), 'none')
)
select check_name, result, detail from (
  select ord, check_name, result, detail from results
  union all
  select 99, 'OVERALL SCHEMA PARITY',
         case when (select count(*) from results where result = 'FAIL') = 0 then 'PASS' else 'FAIL' end,
         (select count(*) from results where result = 'PASS') || ' of 4 checks pass'
) x order by ord;
