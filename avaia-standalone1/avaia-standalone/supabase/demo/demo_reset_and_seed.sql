-- AVAIA DEMONSTRATION: RESET AND SEED. Run in the avaia-demo Supabase project ONLY. Safe to run as many times as you like.
--
-- What it does: removes everything belonging to the two synthetic demo accounts (Eleanor Marsh, the Host, and Nora Castellane, the Guide)
-- and writes the baseline back exactly: one completed Journey (IAP, CAT, InnerCompass) with three referrals, four Coordination items
-- (one decision), the Decision & Capacity Continuity record (7 entries plus 1 withdrawn), and the Guide's certification records.
-- It creates NO share and NO Guide grant: those are done live during the demonstration.
--
-- SAFETY GUARD: it REFUSES to run unless the database contains only the two demo accounts. It cannot touch Production or any real person.
-- ALL DATA IS SYNTHETIC. The Journey conversations are pre-written demonstration content, not live AI output.
-- Needs: the two users already created in Supabase (Authentication > Users):
--   kidathart+avaia-demo-host@gmail.com   and   kidathart+avaia-demo-guide@gmail.com
do $seed$
declare
  c_host_email  constant text := 'kidathart+avaia-demo-host@gmail.com';
  c_guide_email constant text := 'kidathart+avaia-demo-guide@gmail.com';
  v_host uuid; v_guide uuid;
  v_journey uuid; v_iap uuid; v_cat uuid; v_ic uuid;
  v_ref_iap uuid; v_ref_cat uuid; v_ref_ic uuid;
  m_wanted uuid; m_understood uuid; m_reasoning uuid; m_question uuid; m_alt uuid; m_undecided uuid; m_position uuid; m_comm uuid;
  v_decision uuid; v_poa uuid; v_tax uuid; v_care uuid;
  e_reasoning uuid; v_cand uuid;
  -- Daytime anchor: messages are stamped relative to 17:00 UTC (midday in the US), so nobody 'writes' at 2 AM.
  v_base timestamptz := date_trunc('day', now()) + interval '17 hours';
  -- Eleanor's own sentences. Each entry copies one of these verbatim from a message she wrote on the date shown.
  x_wanted     constant text := $q$I want Dad to stay in his house as long as he can be safe there.$q$;
  x_understood constant text := $q$After the fall, the hospital social worker said he should not be alone overnight.$q$;
  x_reasoning  constant text := $q$I can't be there every night, and Paul is four hours away.$q$;
  x_question   constant text := $q$I asked the care manager what overnight help costs and whether his insurance covers any.$q$;
  x_alt        constant text := $q$Maybe a live-in aide for six months, before we decide anything about the sale.$q$;
  x_undecided  constant text := $q$I still don't know whether selling is right.$q$;
  x_position   constant text := $q$I used to say he should stay as long as possible. Now I think he stays only if overnight help is in place, and we decide about the sale after I meet the attorney.$q$;
  x_comm       constant text := $q$Tell Paul I'm not deciding about the sale until the attorney has reviewed Dad's documents.$q$;
begin
  select id into v_host  from auth.users where lower(email) = lower(c_host_email);
  select id into v_guide from auth.users where lower(email) = lower(c_guide_email);
  if v_host is null or v_guide is null then
    raise exception 'The two demo users do not exist yet. Create them first in Supabase (Authentication > Users): % and %', c_host_email, c_guide_email;
  end if;
  if exists (select 1 from auth.users where id not in (v_host, v_guide)) then
    raise exception 'REFUSED: this database has accounts other than the two demo accounts. This script is for the demo database only.';
  end if;

  ------------------------------------------------------------------------------------------------------------------------
  -- RESET: everything that belongs to the two demo accounts, children before parents.
  ------------------------------------------------------------------------------------------------------------------------
  delete from public.coordination_guide_events where host_id = v_host;
  delete from public.coordination_guide_scope  where host_id = v_host;
  delete from public.coordination_guide_grants where host_id = v_host;
  delete from public.coordination_shares       where host_id = v_host;
  delete from public.coordination_entries      where host_id = v_host;
  delete from public.coordination_items        where host_id = v_host;
  delete from public.referrals                 where host_id = v_host;
  delete from public.conversations             where host_id = v_host;
  delete from public.journeys                  where host_id = v_host;
  -- Signing in lands on the Journey page, which can create an empty conversation for the account that signed in. Clear those too.
  delete from public.conversations             where host_id = v_guide;
  delete from public.journeys                  where host_id = v_guide;
  delete from public.guide_platform_authorizations where host_id = v_guide;
  delete from public.guide_certifications          where host_id = v_guide;
  delete from public.guide_candidates              where host_id = v_guide;
  delete from public.entitlements where host_id in (v_host, v_guide);

  ------------------------------------------------------------------------------------------------------------------------
  -- ACCOUNTS: consent, adult, the designated-test marker, and the Guide's certification records.
  ------------------------------------------------------------------------------------------------------------------------
  update public.profiles
     set consent_at = now() - interval '40 days', disclaimer_version = '2026-07-10', adult_confirmed = true
   where id = v_host;
  update public.profiles
     set consent_at = now() - interval '130 days', disclaimer_version = '2026-07-10', adult_confirmed = true,
         role = 'guide', guide_display_name = 'Nora Castellane', guide_certified_at = now() - interval '120 days'
   where id = v_guide;
  insert into public.entitlements (host_id, status, source) values (v_host, 'active', 'founder_test'), (v_guide, 'active', 'founder_test');

  insert into public.guide_candidates (host_id, status, admitted_at, notes)
  values (v_guide, 'admitted', now() - interval '200 days', 'Synthetic demonstration Guide. Not a real person.')
  returning id into v_cand;
  insert into public.guide_certifications (candidate_id, host_id, certified_at, standing)
  values (v_cand, v_guide, now() - interval '120 days', 'active');
  insert into public.guide_platform_authorizations (host_id, capability, status, granted_at, notes)
  values (v_guide, 'coordination_support', 'authorized', now() - interval '30 days', 'Synthetic demonstration Guide.');

  ------------------------------------------------------------------------------------------------------------------------
  -- THE JOURNEY: IAP (36-35 days ago), CAT (22-20 days ago), InnerCompass (8-7 days ago). Pre-written synthetic content.
  ------------------------------------------------------------------------------------------------------------------------
  insert into public.journeys (host_id, program, started_at, completed_at)
  values (v_host, 'general', now() - interval '36 days', now() - interval '7 days') returning id into v_journey;

  -- IAP ------------------------------------------------------------------------------------------------------------------
  insert into public.conversations (host_id, stage, status, program, journey_id, created_at)
  values (v_host, 'iap', 'complete', 'general', v_journey, now() - interval '36 days') returning id into v_iap;
  insert into public.messages (conversation_id, host_id, role, content, created_at) values
    (v_iap, v_host, 'guide', $m$Welcome. You can bring whatever is present, in any order, and there is no right way to begin. What brought you here today?$m$, v_base - interval '35 days 1 hour 30 minutes');
  insert into public.messages (conversation_id, host_id, role, content, created_at) values
    (v_iap, v_host, 'host', $m$My dad fell in September. Everyone keeps asking me the same thing: should Dad sell the house? $m$ || x_wanted || $m$ He has lived there for fifty-one years.$m$, v_base - interval '35 days 1 hour 25 minutes')
    returning id into m_wanted;
  insert into public.messages (conversation_id, host_id, role, content, created_at) values
    (v_iap, v_host, 'guide', $m$Fifty-one years is a long time in one place. What do you know so far about how he is doing since the fall?$m$, v_base - interval '35 days 1 hour 20 minutes');
  insert into public.messages (conversation_id, host_id, role, content, created_at) values
    (v_iap, v_host, 'host', x_understood || $m$ Dad is 86 and he insists he is fine.$m$, v_base - interval '35 days 1 hour 10 minutes')
    returning id into m_understood;
  insert into public.messages (conversation_id, host_id, role, content, created_at) values
    (v_iap, v_host, 'guide', $m$Who else is part of this with you?$m$, v_base - interval '34 days 2 hours');
  insert into public.messages (conversation_id, host_id, role, content, created_at) values
    (v_iap, v_host, 'host', $m$My brother Paul lives four hours away and thinks we should sell now. $m$ || x_reasoning || $m$ I also don't know whether Dad's power of attorney papers are current.$m$, v_base - interval '34 days 1 hour 50 minutes')
    returning id into m_reasoning;
  insert into public.messages (conversation_id, host_id, role, content, created_at) values
    (v_iap, v_host, 'guide', $m$What part of this feels most unsettled for you today?$m$, v_base - interval '34 days 1 hour 40 minutes'),
    (v_iap, v_host, 'host', $m$That I am making decisions for someone who still wants to make his own. And that I am exhausted.$m$, v_base - interval '34 days 1 hour 35 minutes'),
    (v_iap, v_host, 'guide', $m$Thank you for putting all of that on the table. I will gather what you have said into a record you can carry forward.$m$, v_base - interval '34 days 1 hour 30 minutes');

  -- CAT ------------------------------------------------------------------------------------------------------------------
  insert into public.conversations (host_id, stage, status, program, journey_id, created_at)
  values (v_host, 'cat', 'complete', 'general', v_journey, now() - interval '22 days') returning id into v_cat;
  insert into public.messages (conversation_id, host_id, role, content, created_at) values
    (v_cat, v_host, 'guide', $m$Welcome back. Your earlier conversation is with us. What would you like to look at more closely today?$m$, v_base - interval '21 days 3 hours'),
    (v_cat, v_host, 'host', $m$I keep thinking this is about the house, but I think it is really about Dad's independence.$m$, v_base - interval '21 days 2 hours 55 minutes'),
    (v_cat, v_host, 'guide', $m$What else changed for you when his independence changed?$m$, v_base - interval '21 days 2 hours 50 minutes');
  insert into public.messages (conversation_id, host_id, role, content, created_at) values
    (v_cat, v_host, 'host', x_question || $m$ She said it depends on the policy, and I don't know where his policy is.$m$, v_base - interval '21 days 2 hours 40 minutes')
    returning id into m_question;
  insert into public.messages (conversation_id, host_id, role, content, created_at) values
    (v_cat, v_host, 'guide', $m$Is there anything you have considered that you have not yet said out loud?$m$, v_base - interval '20 days 4 hours');
  insert into public.messages (conversation_id, host_id, role, content, created_at) values
    (v_cat, v_host, 'host', x_alt || $m$ I notice I am grieving something that has not happened yet.$m$, v_base - interval '20 days 3 hours 50 minutes')
    returning id into m_alt;
  insert into public.messages (conversation_id, host_id, role, content, created_at) values
    (v_cat, v_host, 'guide', $m$That is worth carrying forward. I will record what became visible so you can bring it to your next conversation.$m$, v_base - interval '20 days 3 hours 40 minutes');

  -- InnerCompass ---------------------------------------------------------------------------------------------------------
  insert into public.conversations (host_id, stage, status, program, journey_id, created_at)
  values (v_host, 'innercompass', 'complete', 'general', v_journey, now() - interval '8 days') returning id into v_ic;
  insert into public.messages (conversation_id, host_id, role, content, created_at) values
    (v_ic, v_host, 'guide', $m$Welcome. This is where you can look at a decision you are working through. What is it, in your own words?$m$, v_base - interval '8 days 2 hours');
  insert into public.messages (conversation_id, host_id, role, content, created_at) values
    (v_ic, v_host, 'host', x_undecided || $m$ I have the money question, the safety question and Paul's opinion all mixed together.$m$, v_base - interval '8 days 1 hour 50 minutes')
    returning id into m_undecided;
  insert into public.messages (conversation_id, host_id, role, content, created_at) values
    (v_ic, v_host, 'guide', $m$What would you need to know to separate them?$m$, v_base - interval '7 days 3 hours');
  insert into public.messages (conversation_id, host_id, role, content, created_at) values
    (v_ic, v_host, 'host', $m$Whether his documents are in order, and what overnight help really costs. $m$ || x_position, v_base - interval '7 days 2 hours 50 minutes')
    returning id into m_position;
  insert into public.messages (conversation_id, host_id, role, content, created_at) values
    (v_ic, v_host, 'guide', $m$Is there anything you want to be sure other people hear from you?$m$, v_base - interval '7 days 2 hours 40 minutes');
  insert into public.messages (conversation_id, host_id, role, content, created_at) values
    (v_ic, v_host, 'host', x_comm, v_base - interval '7 days 2 hours 30 minutes')
    returning id into m_comm;
  insert into public.messages (conversation_id, host_id, role, content, created_at) values
    (v_ic, v_host, 'guide', $m$You have named a direction and a next step in your own words. I will record it exactly as you said it.$m$, v_base - interval '7 days 2 hours 20 minutes');

  ------------------------------------------------------------------------------------------------------------------------
  -- THE THREE REFERRALS (what each conversation handed forward), in the shapes the product stores.
  ------------------------------------------------------------------------------------------------------------------------
  insert into public.referrals (host_id, from_stage, to_stage, conversation_id, created_at, content) values (
    v_host, 'iap', 'cat', v_iap, v_base - interval '34 days 1 hour 25 minutes',
    $j${
      "hostOverview": "Eleanor is 63. Her father Walter, 86, fell in September, and the family keeps asking her whether he should sell the house.",
      "title": "Should Dad sell the house?",
      "currentConcern": "Whether her father can stay in his home of fifty-one years, and what she owes him and herself.",
      "primaryThreads": ["Her father's independence", "Safety at night", "Money and the house", "Her brother's pressure to sell"],
      "significantRelationships": ["Her father, Walter", "Her brother, Paul, four hours away"],
      "internalTensions": ["Deciding for someone who still wants to decide for himself", "Wanting to honor him while being exhausted"],
      "strengthsAndSupports": ["A care manager she trusts", "Her own persistence and care"],
      "listeningCues": ["Says 'Dad is fine' when worried", "Returns to the house when the real subject is independence"],
      "areasForExploration": ["What changes if he stays", "What changes if he moves", "What she can sustain"],
      "hostPriorities": ["Her father's dignity", "Safety", "Not letting the decision be made in a rush"],
      "desiredDirection": "A decision about the house that her father, her brother and she can each live with.",
      "secondaryLossesIdentified": [
        {"category": "Control", "description": "Events are moving faster than she can steer them."},
        {"category": "Loss of Capacity", "description": "She no longer feels able to carry everything she used to carry for him."}
      ],
      "governingNarratives": ["I am the one who is nearby, so it is mine to handle."],
      "anchorStatements": ["I want Dad to stay in his house as long as he can be safe there."],
      "reflectionsThatEmerged": ["The question about the house is carrying a larger question about independence."],
      "questionsWorthCarrying": ["What would safe actually look like for him?"],
      "nextConversationPurpose": "To look underneath the house question at what has changed and what is being lost.",
      "boundariesToProtect": ["Her father's own voice in any decision about him"]
    }$j$::jsonb) returning id into v_ref_iap;

  insert into public.referrals (host_id, from_stage, to_stage, conversation_id, created_at, content) values (
    v_host, 'cat', 'innercompass', v_cat, v_base - interval '20 days 3 hours 40 minutes',
    $j${
      "hostOverview": "Eleanor sees that the house question is really about her father's independence, and that she is grieving something that has not happened yet.",
      "title": "Underneath the house",
      "majorUnderstandings": ["The decision is tangled with grief about her father's independence", "She needs facts about cost and coverage before she can weigh options"],
      "primaryLoss": "Her father's independence and the life he built in that house.",
      "significantSecondaryLosses": [
        {"category": "Identity", "description": "She is shifting from daughter to decision-maker."},
        {"category": "Attachment / Support", "description": "Her brother is far away and not carrying the weight with her."}
      ],
      "keyRecognitions": ["She is anticipating a loss that has not yet happened", "A live-in aide may buy time before any sale decision"],
      "identityThreads": ["The responsible daughter", "A person who cannot do everything alone"],
      "activeTensions": ["Honoring her father's wishes while keeping him safe", "Her limits against her sense of duty"],
      "relevantVirtues": [{"family": "love", "element": "Devotion"}, {"family": "wisdom", "element": "Prudence"}],
      "restorationTargets": ["Share the load", "Replace guessing with documents and numbers"],
      "councilPerspectives": [],
      "unresolvedQuestions": ["Where is his insurance policy?", "Are his legal papers current?"],
      "integrationPoints": ["Overnight help and the sale can be decided separately"],
      "anchorStatements": ["Maybe a live-in aide for six months, before we decide anything about the sale."],
      "reflectionsThatEmerged": ["She does not have to decide everything at once."],
      "questionsWorthCarrying": ["What can I stop carrying alone?"],
      "nextConversationPurpose": "To reach a direction on the house and a next step she can take.",
      "boundariesToProtect": ["Her father's right to be heard", "Her own limits"]
    }$j$::jsonb) returning id into v_ref_cat;

  insert into public.referrals (host_id, from_stage, to_stage, conversation_id, created_at, content) values (
    v_host, 'innercompass', 'continuity', v_ic, v_base - interval '7 days 2 hours 20 minutes',
    $j${
      "roomIdentity": "Eleanor's decision about her father's house",
      "outcomeType": "direction_chosen",
      "centralDecisionOrDirection": "Her father stays in the house only if overnight help is in place, and the decision about the sale waits until she has met the attorney.",
      "rationale": "She does not yet have his documents or the cost of overnight help, and she does not want the decision made in a rush.",
      "virtuesInvolved": [{"family": "wisdom", "element": "Judgment"}, {"family": "love", "element": "Devotion"}],
      "obstacles": ["Her brother wants to sell now", "She does not know whether his legal papers are current"],
      "capacityConsiderations": "I do not currently have the capacity to handle his finances on top of caring for him overnight. I need others to carry some of this.",
      "nextStep": "Meet with the elder-law attorney before talking with Paul about the house.",
      "followUpQuestions": ["Who can carry his tax filing?", "What will overnight help cost, and what does his policy cover?"],
      "anchorStatements": ["Tell Paul I'm not deciding about the sale until the attorney has reviewed Dad's documents."],
      "reflectionsThatEmerged": ["Separating the questions makes each one smaller."],
      "questionsWorthCarrying": ["What does he want, in his own words?"],
      "decisionsMade": ["Overnight help comes before any decision about the sale."],
      "commitmentsChosen": ["Schedule the first attorney meeting", "Ask the CPA to take on the October payment"],
      "whatToPreserve": "Her father's voice in the decision, and her own limits.",
      "boundariesToProtect": ["Her father's dignity", "Her own capacity"]
    }$j$::jsonb) returning id into v_ref_ic;

  ------------------------------------------------------------------------------------------------------------------------
  -- COORDINATION: three items and one decision, all chosen by Eleanor. Open, Waiting and Closed.
  ------------------------------------------------------------------------------------------------------------------------
  insert into public.coordination_items (host_id, kind, title, category, delegation_state, status, related_conversation_id, related_referral_id, created_at, updated_at)
  values (v_host, 'decision', 'Whether Dad stays in his house', 'Family and home', 'need_help_before_deciding', 'open', v_ic, v_ref_ic, now() - interval '35 days', now() - interval '2 days')
  returning id into v_decision;

  insert into public.coordination_items (host_id, kind, title, category, delegation_state, professional_name, professional_role, status, next_action, due_date, related_decision_id, created_at, updated_at)
  values (v_host, 'item', 'Confirm Dad''s power of attorney and who can act', 'Legal', 'belongs_with_professional', 'Priya Raman', 'Elder-law attorney', 'open',
          'Bring Dad''s documents to the first meeting', current_date + 6, v_decision, now() - interval '20 days', now() - interval '3 days')
  returning id into v_poa;

  insert into public.coordination_items (host_id, kind, title, category, delegation_state, professional_name, professional_role, status, waiting_on, waiting_on_note, next_action, due_date, related_decision_id, created_at, updated_at)
  values (v_host, 'item', 'Dad''s tax filing and the October estimated payment', 'Money', 'no_capacity_now', 'Tom Kessler', 'CPA', 'waiting', 'professional',
          'Waiting for the CPA to confirm what he needs from me', 'Ask what documents Tom needs', current_date + 12, v_decision, now() - interval '18 days', now() - interval '4 days')
  returning id into v_tax;

  insert into public.coordination_items (host_id, kind, title, category, delegation_state, assigned_to_name, assigned_to_role, status, closed_at, related_decision_id, created_at, updated_at)
  values (v_host, 'item', 'Home-care needs assessment', 'Care', 'someone_else_owns', 'Joan Abernathy', 'Care manager', 'closed', now() - interval '5 days', v_decision, now() - interval '30 days', now() - interval '5 days')
  returning id into v_care;

  ------------------------------------------------------------------------------------------------------------------------
  -- THE DECISION & CAPACITY CONTINUITY RECORD: 7 entries in Eleanor's own words, copied from her own Journey messages on their real
  -- dates (the database stamps typed entries with the time they are typed and never allows back-dating), plus 1 she later withdrew.
  ------------------------------------------------------------------------------------------------------------------------
  insert into public.coordination_entries (host_id, item_id, entry_type, source_kind, occurred_at, excerpt, conversation_id, message_id) values
    (v_host, v_decision, 'wanted',      'conversation_message', now(), x_wanted,     v_iap, m_wanted),
    (v_host, v_decision, 'understood',  'conversation_message', now(), x_understood, v_iap, m_understood);
  insert into public.coordination_entries (host_id, item_id, entry_type, source_kind, occurred_at, excerpt, conversation_id, message_id)
  values (v_host, v_decision, 'reasoning', 'conversation_message', now(), x_reasoning, v_iap, m_reasoning)
  returning id into e_reasoning;
  insert into public.coordination_entries (host_id, item_id, entry_type, source_kind, occurred_at, excerpt, conversation_id, message_id) values
    (v_host, v_decision, 'question',    'conversation_message', now(), x_question,   v_cat, m_question),
    (v_host, v_decision, 'alternative', 'conversation_message', now(), x_alt,        v_cat, m_alt),
    (v_host, v_decision, 'undecided',   'conversation_message', now(), x_undecided,  v_ic,  m_undecided);
  insert into public.coordination_entries (host_id, item_id, entry_type, source_kind, occurred_at, excerpt, conversation_id, message_id, host_note)
  values (v_host, v_decision, 'position_changed', 'conversation_message', now(), x_position, v_ic, m_position,
          'This changed after the care manager told me what overnight help depends on.');
  insert into public.coordination_entries (host_id, item_id, entry_type, source_kind, occurred_at, excerpt, conversation_id, message_id) values
    (v_host, v_decision, 'communicate_to_others', 'conversation_message', now(), x_comm, v_ic, m_comm);
  -- Eleanor withdrew her earlier reasoning (the entry stays on the timeline, flagged as withdrawn).
  update public.coordination_entries set withdrawn_at = now() where id = e_reasoning;
end
$seed$;

-- Self-labelling result: what the baseline now contains.
select 'DEMO BASELINE WRITTEN' as status,
       (select count(*) from public.conversations c join auth.users u on u.id = c.host_id where lower(u.email) = 'kidathart+avaia-demo-host@gmail.com') as conversations_expect_3,
       (select count(*) from public.referrals r join auth.users u on u.id = r.host_id where lower(u.email) = 'kidathart+avaia-demo-host@gmail.com') as referrals_expect_3,
       (select count(*) from public.coordination_items i join auth.users u on u.id = i.host_id where lower(u.email) = 'kidathart+avaia-demo-host@gmail.com') as items_expect_4,
       (select count(*) from public.coordination_entries e join auth.users u on u.id = e.host_id where lower(u.email) = 'kidathart+avaia-demo-host@gmail.com') as entries_expect_8,
       (select count(*) from public.coordination_entries e join auth.users u on u.id = e.host_id where lower(u.email) = 'kidathart+avaia-demo-host@gmail.com' and e.withdrawn_at is not null) as withdrawn_expect_1;
