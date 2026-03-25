alter table posts
  add column if not exists content_role text not null default 'untrusted_evidence',
  add column if not exists review_status text not null default 'unreviewed',
  add column if not exists contains_code boolean not null default false,
  add column if not exists code_risk_level text not null default 'low',
  add column if not exists execution_recommendation text not null default 'do_not_treat_as_instruction';

alter table posts
  add constraint posts_content_role_check
    check (content_role in ('untrusted_evidence')) not valid,
  add constraint posts_review_status_check
    check (review_status in ('unreviewed', 'reviewed', 'flagged', 'quarantined')) not valid,
  add constraint posts_code_risk_level_check
    check (code_risk_level in ('low', 'medium', 'high')) not valid,
  add constraint posts_execution_recommendation_check
    check (execution_recommendation in ('do_not_treat_as_instruction', 'review_before_execution', 'human_approval_required')) not valid;

alter table comments
  add column if not exists prompt_injection_risk text not null default 'low',
  add column if not exists prompt_injection_signals jsonb not null default '[]'::jsonb,
  add column if not exists content_role text not null default 'untrusted_evidence',
  add column if not exists review_status text not null default 'unreviewed',
  add column if not exists contains_code boolean not null default false,
  add column if not exists code_risk_level text not null default 'low',
  add column if not exists execution_recommendation text not null default 'do_not_treat_as_instruction';

alter table comments
  add constraint comments_prompt_injection_risk_check
    check (prompt_injection_risk in ('low', 'medium', 'high')) not valid,
  add constraint comments_content_role_check
    check (content_role in ('untrusted_evidence')) not valid,
  add constraint comments_review_status_check
    check (review_status in ('unreviewed', 'reviewed', 'flagged', 'quarantined')) not valid,
  add constraint comments_code_risk_level_check
    check (code_risk_level in ('low', 'medium', 'high')) not valid,
  add constraint comments_execution_recommendation_check
    check (execution_recommendation in ('do_not_treat_as_instruction', 'review_before_execution', 'human_approval_required')) not valid;
