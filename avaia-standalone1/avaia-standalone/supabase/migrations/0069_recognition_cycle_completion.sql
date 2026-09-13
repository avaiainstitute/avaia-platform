-- Completes the established Recognition Cycle (Observe -> Acknowledge ->
-- Reflect -> Practice -> Contribute, see lib/engine/prompts.ts's own
-- cross-reference comment above UNSUNG_HEROES_INSTRUCTIONS) for Unsung
-- Heroes. Observe, Reflect, and Practice were already represented
-- (who_became_visible/story, reflection, next_practice). Acknowledge and
-- Contribute had no field to be captured in; these two nullable columns are
-- the smallest addition that lets the model actually save what the
-- conversation already surfaces once the corresponding prompt guidance asks
-- for it. Neither column changes the four-option entry mechanism, adds
-- "Four Paths" branding, or touches the Library.

alter table public.recognitions
  add column if not exists acknowledgment text,
  add column if not exists contribution text;

comment on column public.recognitions.acknowledgment is
  'Recognition Cycle Acknowledge stage: the virtue the Guide named back to the Host in the moment (most often on Path Two, "someone recognized me") and how the Host received it, in their own words. Nullable, most entries will leave this empty.';
comment on column public.recognitions.contribution is
  'Recognition Cycle Contribute stage: what the Host intends to carry forward or pass on as a result of this recognition (e.g. telling the person directly), in their own words. Distinct from next_practice (the Host practicing the virtue themselves) and from community_impact (the effect of the original moment). Nullable. Not a Library submission -- no Library link is implied or created by this column.';
