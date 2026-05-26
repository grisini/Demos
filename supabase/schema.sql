-- Demos / Demokracija 2.0 schema for Supabase PostgreSQL.
-- Matches the data model used in:
-- - src/domain/validation.js
-- - src/lib/supabase.js
-- - src/domain/analytics.js

create extension if not exists pgcrypto;

do $$ begin
  create type initiative_status as enum (
    'draft',
    'review',
    'active',
    'signature_collection',
    'submitted',
    'rejected'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type initiative_category as enum (
    'Javne finance',
    'Zdravstvo',
    'Okolje',
    'Izobrazevanje',
    'Pravosodje',
    'Digitalna drzava',
    'Drugo'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type ai_risk_level as enum (
    'low',
    'medium',
    'high'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type ai_suitability as enum (
    'ready',
    'needs_review',
    'insufficient'
  );
exception
  when duplicate_object then null;
end $$;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists initiatives (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) >= 8),
  summary text not null check (char_length(trim(summary)) >= 40),
  description text not null check (char_length(trim(description)) >= 120),
  category initiative_category not null,
  legal_reference text not null default '',
  expected_impact text not null default '',
  legislative_text text not null default '',
  article_explanation text not null default '',
  financial_impact text not null default '',
  budget_funding text not null default '',
  comparative_review text not null default '',
  impact_assessment text not null default '',
  public_participation text not null default '',
  proposer_representatives text not null default '',
  affected_provisions text not null default '',
  status initiative_status not null default 'review',
  author_ref text not null,
  author_name text not null,
  ai_score integer not null default 0 check (ai_score between 0 and 100),
  ai_risk ai_risk_level not null default 'low',
  ai_findings jsonb not null default '[]'::jsonb,
  ai_checks jsonb not null default '{}'::jsonb,
  ai_reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table initiatives add column if not exists legislative_text text not null default '';
alter table initiatives add column if not exists article_explanation text not null default '';
alter table initiatives add column if not exists financial_impact text not null default '';
alter table initiatives add column if not exists budget_funding text not null default '';
alter table initiatives add column if not exists comparative_review text not null default '';
alter table initiatives add column if not exists impact_assessment text not null default '';
alter table initiatives add column if not exists public_participation text not null default '';
alter table initiatives add column if not exists proposer_representatives text not null default '';
alter table initiatives add column if not exists affected_provisions text not null default '';

create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  initiative_id uuid not null references initiatives(id) on delete cascade,
  voter_ref text not null,
  voter_name text not null,
  created_at timestamptz not null default now(),
  unique (initiative_id, voter_ref)
);

create table if not exists signatures (
  id uuid primary key default gen_random_uuid(),
  initiative_id uuid not null references initiatives(id) on delete cascade,
  signer_ref text not null,
  signer_name text not null,
  method text not null default 'demo',
  created_at timestamptz not null default now(),
  unique (initiative_id, signer_ref)
);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  initiative_id uuid not null references initiatives(id) on delete cascade,
  author_ref text not null,
  author_name text not null,
  body text not null check (char_length(trim(body)) between 3 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists initiative_ai_reviews (
  id uuid primary key default gen_random_uuid(),
  initiative_id uuid not null references initiatives(id) on delete cascade,
  provider text not null default 'local',
  model text not null default 'local-rule-engine-v1',
  score integer not null check (score between 0 and 100),
  risk ai_risk_level not null,
  suitability ai_suitability not null,
  suggested_category initiative_category,
  findings jsonb not null default '[]'::jsonb,
  checks jsonb not null default '{}'::jsonb,
  raw_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists system_analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  source text not null default 'frontend',
  user_ref text,
  user_role text,
  session_id text,
  path text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists initiatives_status_idx on initiatives(status);
create index if not exists initiatives_category_idx on initiatives(category);
create index if not exists initiatives_created_at_idx on initiatives(created_at desc);
create index if not exists votes_initiative_idx on votes(initiative_id);
create index if not exists signatures_initiative_idx on signatures(initiative_id);
create index if not exists comments_initiative_idx on comments(initiative_id);
create index if not exists comments_created_at_idx on comments(created_at asc);
create index if not exists initiative_ai_reviews_initiative_idx on initiative_ai_reviews(initiative_id);
create index if not exists initiative_ai_reviews_created_idx on initiative_ai_reviews(created_at desc);
create index if not exists system_analytics_events_created_idx on system_analytics_events(created_at desc);
create index if not exists system_analytics_events_type_idx on system_analytics_events(event_type);
create index if not exists system_analytics_events_user_idx on system_analytics_events(user_ref);

drop trigger if exists initiatives_set_updated_at on initiatives;
create trigger initiatives_set_updated_at
before update on initiatives
for each row
execute function set_updated_at();

alter table initiatives enable row level security;
alter table votes enable row level security;
alter table signatures enable row level security;
alter table comments enable row level security;
alter table initiative_ai_reviews enable row level security;
alter table system_analytics_events enable row level security;

drop policy if exists "prototype read initiatives" on initiatives;
drop policy if exists "prototype insert initiatives" on initiatives;
drop policy if exists "prototype update initiatives" on initiatives;
drop policy if exists "prototype read votes" on votes;
drop policy if exists "prototype insert votes" on votes;
drop policy if exists "prototype read signatures" on signatures;
drop policy if exists "prototype insert signatures" on signatures;
drop policy if exists "prototype read comments" on comments;
drop policy if exists "prototype insert comments" on comments;
drop policy if exists "prototype read ai reviews" on initiative_ai_reviews;
drop policy if exists "prototype insert ai reviews" on initiative_ai_reviews;
drop policy if exists "prototype read system analytics events" on system_analytics_events;
drop policy if exists "prototype insert system analytics events" on system_analytics_events;

create policy "prototype read initiatives"
  on initiatives for select
  using (true);

create policy "prototype insert initiatives"
  on initiatives for insert
  with check (true);

create policy "prototype update initiatives"
  on initiatives for update
  using (true)
  with check (true);

create policy "prototype read votes"
  on votes for select
  using (true);

create policy "prototype insert votes"
  on votes for insert
  with check (true);

create policy "prototype read signatures"
  on signatures for select
  using (true);

create policy "prototype insert signatures"
  on signatures for insert
  with check (true);

create policy "prototype read comments"
  on comments for select
  using (true);

create policy "prototype insert comments"
  on comments for insert
  with check (true);

create policy "prototype read ai reviews"
  on initiative_ai_reviews for select
  using (true);

create policy "prototype insert ai reviews"
  on initiative_ai_reviews for insert
  with check (true);

-- No public RLS policy is created for system_analytics_events.
-- Vercel serverless functions should access it with SUPABASE_SERVICE_ROLE_KEY.

create or replace view initiative_detail as
select
  i.id,
  i.title,
  i.summary,
  i.description,
  i.category,
  i.legal_reference,
  i.expected_impact,
  i.status,
  i.author_ref,
  i.author_name,
  i.ai_score,
  i.ai_risk,
  i.ai_findings,
  i.ai_checks,
  i.ai_reviewed_at,
  i.created_at,
  i.updated_at,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'userId', v.voter_ref,
          'userName', v.voter_name,
          'createdAt', v.created_at
        )
        order by v.created_at asc
      )
      from votes v
      where v.initiative_id = i.id
    ),
    '[]'::jsonb
  ) as votes,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'userId', s.signer_ref,
          'userName', s.signer_name,
          'method', s.method,
          'createdAt', s.created_at
        )
        order by s.created_at asc
      )
      from signatures s
      where s.initiative_id = i.id
    ),
    '[]'::jsonb
  ) as signatures,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'userId', c.author_ref,
          'userName', c.author_name,
          'body', c.body,
          'createdAt', c.created_at
        )
        order by c.created_at asc
      )
      from comments c
      where c.initiative_id = i.id
    ),
    '[]'::jsonb
  ) as comments,
  i.legislative_text,
  i.article_explanation,
  i.financial_impact,
  i.budget_funding,
  i.comparative_review,
  i.impact_assessment,
  i.public_participation,
  i.proposer_representatives,
  i.affected_provisions
from initiatives i;

create or replace view initiative_analytics as
with vote_counts as (
  select initiative_id, count(*)::int as vote_count
  from votes
  group by initiative_id
),
signature_counts as (
  select initiative_id, count(*)::int as signature_count
  from signatures
  group by initiative_id
),
comment_counts as (
  select initiative_id, count(*)::int as comment_count
  from comments
  group by initiative_id
),
latest_activity as (
  select
    i.id as initiative_id,
    greatest(
      i.updated_at,
      i.created_at,
      coalesce((select max(v.created_at) from votes v where v.initiative_id = i.id), i.created_at),
      coalesce((select max(s.created_at) from signatures s where s.initiative_id = i.id), i.created_at),
      coalesce((select max(c.created_at) from comments c where c.initiative_id = i.id), i.created_at)
    ) as latest_activity_at
  from initiatives i
),
total_votes as (
  select coalesce(sum(vote_count), 0)::numeric as value
  from vote_counts
)
select
  i.id,
  i.title,
  i.category,
  i.status,
  coalesce(v.vote_count, 0) as vote_count,
  coalesce(s.signature_count, 0) as signature_count,
  coalesce(c.comment_count, 0) as comment_count,
  coalesce(v.vote_count, 0) + coalesce(s.signature_count, 0) as support_count,
  case
    when t.value = 0 then 0
    else round((coalesce(v.vote_count, 0)::numeric / t.value) * 100, 1)
  end as vote_share_percent,
  case
    when coalesce(v.vote_count, 0) = 0 then 0
    else round((coalesce(s.signature_count, 0)::numeric / coalesce(v.vote_count, 0)) * 100, 1)
  end as signature_conversion_percent,
  round((coalesce(v.vote_count, 0) + coalesce(s.signature_count, 0) + coalesce(c.comment_count, 0) * 0.5)::numeric, 1) as engagement_score,
  i.ai_score,
  i.ai_risk,
  i.ai_checks -> 'categorySuggestion' as category_suggestion,
  la.latest_activity_at,
  i.created_at,
  i.updated_at
from initiatives i
cross join total_votes t
left join vote_counts v on v.initiative_id = i.id
left join signature_counts s on s.initiative_id = i.id
left join comment_counts c on c.initiative_id = i.id
left join latest_activity la on la.initiative_id = i.id;

create or replace view category_analytics as
select
  category,
  count(*)::int as initiative_count,
  sum(vote_count)::int as vote_count,
  sum(signature_count)::int as signature_count,
  sum(comment_count)::int as comment_count,
  round(avg(ai_score), 1) as average_ai_score,
  round(avg(vote_count), 1) as average_votes
from initiative_analytics
group by category;
