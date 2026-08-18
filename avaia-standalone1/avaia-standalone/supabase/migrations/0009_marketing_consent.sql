-- Marketing consent — kept fully separate from consent_at (the required
-- legal/eligibility disclaimer). A Host's account existing, and even their
-- legal consent to use AVAIA, never implies permission to send marketing;
-- this is a distinct, optional, off-by-default choice, captured (and, in
-- the future, changeable) independently of consent_at.

alter table public.profiles
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists marketing_consent_at timestamptz,
  add column if not exists marketing_consent_source text;
