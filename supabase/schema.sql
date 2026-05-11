-- Demokracija 2.0 prototype schema for Supabase/PostgreSQL.
-- Prototype policies allow public read/write with the anon key so the static app can run.
-- Before production, move writes behind a backend and tighten RLS to SI-PASS verified identities.

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

create table if not exists initiatives (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text not null,
  description text not null,
  category text not null,
  legal_reference text,
  expected_impact text,
  status initiative_status not null default 'review',
  author_ref text not null,
  author_name text not null,
  ai_score integer not null default 0 check (ai_score between 0 and 100),
  ai_risk text not null default 'low',
  ai_findings jsonb not null default '[]'::jsonb,
  ai_checks jsonb not null default '{}'::jsonb,
  ai_reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  body text not null check (char_length(body) between 3 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists initiative_ai_reviews (
  id uuid primary key default gen_random_uuid(),
  initiative_id uuid not null references initiatives(id) on delete cascade,
  provider text not null default 'local',
  model text not null default 'local-rule-engine-v1',
  score integer not null check (score between 0 and 100),
  risk text not null check (risk in ('low', 'medium', 'high')),
  suitability text not null check (suitability in ('ready', 'needs_review', 'insufficient')),
  suggested_category text,
  findings jsonb not null default '[]'::jsonb,
  checks jsonb not null default '{}'::jsonb,
  raw_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists initiatives_status_idx on initiatives(status);
create index if not exists initiatives_category_idx on initiatives(category);
create index if not exists votes_initiative_idx on votes(initiative_id);
create index if not exists signatures_initiative_idx on signatures(initiative_id);
create index if not exists comments_initiative_idx on comments(initiative_id);
create index if not exists initiative_ai_reviews_initiative_idx on initiative_ai_reviews(initiative_id);
create index if not exists initiative_ai_reviews_created_idx on initiative_ai_reviews(created_at desc);

alter table initiatives enable row level security;
alter table votes enable row level security;
alter table signatures enable row level security;
alter table comments enable row level security;
alter table initiative_ai_reviews enable row level security;

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
  i.ai_score,
  i.ai_risk,
  i.ai_checks -> 'categorySuggestion' as category_suggestion,
  i.created_at,
  i.updated_at
from initiatives i
cross join total_votes t
left join vote_counts v on v.initiative_id = i.id
left join signature_counts s on s.initiative_id = i.id
left join comment_counts c on c.initiative_id = i.id;

create or replace view category_analytics as
select
  category,
  count(*)::int as initiative_count,
  sum(vote_count)::int as vote_count,
  sum(signature_count)::int as signature_count,
  sum(comment_count)::int as comment_count,
  round(avg(ai_score), 1) as average_ai_score
from initiative_analytics
group by category;
