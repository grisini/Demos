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

create index if not exists initiatives_status_idx on initiatives(status);
create index if not exists initiatives_category_idx on initiatives(category);
create index if not exists votes_initiative_idx on votes(initiative_id);
create index if not exists signatures_initiative_idx on signatures(initiative_id);
create index if not exists comments_initiative_idx on comments(initiative_id);

alter table initiatives enable row level security;
alter table votes enable row level security;
alter table signatures enable row level security;
alter table comments enable row level security;

drop policy if exists "prototype read initiatives" on initiatives;
drop policy if exists "prototype insert initiatives" on initiatives;
drop policy if exists "prototype update initiatives" on initiatives;
drop policy if exists "prototype read votes" on votes;
drop policy if exists "prototype insert votes" on votes;
drop policy if exists "prototype read signatures" on signatures;
drop policy if exists "prototype insert signatures" on signatures;
drop policy if exists "prototype read comments" on comments;
drop policy if exists "prototype insert comments" on comments;

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

