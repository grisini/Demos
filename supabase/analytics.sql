-- Demos / Demokracija 2.0 analytics storage for Supabase PostgreSQL.
-- Run this after supabase/schema.sql.
--
-- The existing app writes frontend/system telemetry to system_analytics_events
-- through api/analytics/system.js. This script keeps that table compatible,
-- adds a central analytics_events stream, backfills current data, and creates
-- SQL views/snapshots for reporting.

create extension if not exists pgcrypto;

create or replace function public.analytics_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.analytics_try_uuid(value text)
returns uuid
language plpgsql
immutable
as $$
begin
  if value is null or btrim(value) = '' then
    return null;
  end if;

  return value::uuid;
exception
  when others then
    return null;
end;
$$;

create or replace function public.analytics_jsonb_number(payload jsonb, key text)
returns numeric
language sql
immutable
as $$
  select case
    when coalesce(payload ->> key, '') ~ '^-?[0-9]+(\.[0-9]+)?$'
      then (payload ->> key)::numeric
    else null
  end;
$$;

create or replace function public.analytics_jsonb_boolean(payload jsonb, key text)
returns boolean
language sql
immutable
as $$
  select case lower(coalesce(payload ->> key, ''))
    when 'true' then true
    when 'false' then false
    else null
  end;
$$;

-- Compatibility table used by the current Vercel API endpoint.
create table if not exists public.system_analytics_events (
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

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  external_id text not null default gen_random_uuid()::text unique,
  event_type text not null,
  source text not null default 'frontend',
  user_ref text,
  user_role text,
  session_id text,
  path text,
  initiative_id uuid,
  occurred_at timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if to_regclass('public.initiatives') is not null
    and not exists (
      select 1
      from pg_constraint
      where conname = 'analytics_events_initiative_id_fkey'
        and conrelid = 'public.analytics_events'::regclass
    )
  then
    alter table public.analytics_events
      add constraint analytics_events_initiative_id_fkey
      foreign key (initiative_id) references public.initiatives(id)
      on delete set null;
  end if;
end $$;

create table if not exists public.analytics_clarity_snapshots (
  id uuid primary key default gen_random_uuid(),
  metric_date date not null default current_date,
  days smallint not null default 1 check (days between 1 and 3),
  dimension text not null default 'URL',
  fetched_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  normalized jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (metric_date, days, dimension)
);

create table if not exists public.analytics_daily_snapshots (
  snapshot_date date primary key,
  initiative_count integer not null default 0,
  vote_count integer not null default 0,
  signature_count integer not null default 0,
  comment_count integer not null default 0,
  stored_ai_review_count integer not null default 0,
  system_event_count integer not null default 0,
  ai_event_count integer not null default 0,
  ai_estimated_tokens integer not null default 0,
  ai_fallback_count integer not null default 0,
  email_event_count integer not null default 0,
  email_notification_count integer not null default 0,
  anonymous_vote_count integer not null default 0,
  unique_session_count integer not null default 0,
  unique_participant_count integer not null default 0,
  public_initiative_count integer not null default 0,
  status_breakdown jsonb not null default '[]'::jsonb,
  category_breakdown jsonb not null default '[]'::jsonb,
  event_type_breakdown jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists system_analytics_events_created_idx
  on public.system_analytics_events(created_at desc);
create index if not exists system_analytics_events_type_idx
  on public.system_analytics_events(event_type);
create index if not exists system_analytics_events_user_idx
  on public.system_analytics_events(user_ref);

create index if not exists analytics_events_occurred_idx
  on public.analytics_events(occurred_at desc);
create index if not exists analytics_events_type_occurred_idx
  on public.analytics_events(event_type, occurred_at desc);
create index if not exists analytics_events_source_idx
  on public.analytics_events(source);
create index if not exists analytics_events_user_idx
  on public.analytics_events(user_ref);
create index if not exists analytics_events_session_idx
  on public.analytics_events(session_id);
create index if not exists analytics_events_initiative_idx
  on public.analytics_events(initiative_id);
create index if not exists analytics_events_data_idx
  on public.analytics_events using gin (data jsonb_path_ops);

create index if not exists analytics_clarity_snapshots_date_idx
  on public.analytics_clarity_snapshots(metric_date desc, dimension);
create index if not exists analytics_daily_snapshots_generated_idx
  on public.analytics_daily_snapshots(generated_at desc);

drop trigger if exists analytics_events_set_updated_at on public.analytics_events;
create trigger analytics_events_set_updated_at
before update on public.analytics_events
for each row
execute function public.analytics_set_updated_at();

drop trigger if exists analytics_clarity_snapshots_set_updated_at on public.analytics_clarity_snapshots;
create trigger analytics_clarity_snapshots_set_updated_at
before update on public.analytics_clarity_snapshots
for each row
execute function public.analytics_set_updated_at();

drop trigger if exists analytics_daily_snapshots_set_updated_at on public.analytics_daily_snapshots;
create trigger analytics_daily_snapshots_set_updated_at
before update on public.analytics_daily_snapshots
for each row
execute function public.analytics_set_updated_at();

alter table public.system_analytics_events enable row level security;
alter table public.analytics_events enable row level security;
alter table public.analytics_clarity_snapshots enable row level security;
alter table public.analytics_daily_snapshots enable row level security;

-- No public RLS policies are created for analytics tables.
-- Use SUPABASE_SERVICE_ROLE_KEY from server-side code or the Supabase SQL editor.

create or replace function public.analytics_sync_system_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into public.analytics_events (
      external_id,
      event_type,
      source,
      user_ref,
      user_role,
      session_id,
      path,
      initiative_id,
      occurred_at,
      data
    )
    values (
      coalesce(nullif(new.data ->> 'id', ''), 'system:' || new.id::text),
      new.event_type,
      coalesce(nullif(new.source, ''), 'frontend'),
      nullif(new.user_ref, ''),
      nullif(new.user_role, ''),
      nullif(new.session_id, ''),
      nullif(new.path, ''),
      public.analytics_try_uuid(new.data ->> 'initiativeId'),
      coalesce(new.created_at, now()),
      coalesce(new.data, '{}'::jsonb)
    )
    on conflict (external_id) do update
      set event_type = excluded.event_type,
          source = excluded.source,
          user_ref = excluded.user_ref,
          user_role = excluded.user_role,
          session_id = excluded.session_id,
          path = excluded.path,
          initiative_id = excluded.initiative_id,
          occurred_at = excluded.occurred_at,
          data = excluded.data;
  exception
    when others then
      null;
  end;

  return new;
end;
$$;

drop trigger if exists analytics_system_events_insert on public.system_analytics_events;
create trigger analytics_system_events_insert
after insert on public.system_analytics_events
for each row
execute function public.analytics_sync_system_event();

create or replace function public.analytics_record_initiative_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into public.analytics_events (
      external_id,
      event_type,
      source,
      user_ref,
      user_role,
      initiative_id,
      occurred_at,
      data
    )
    values (
      'initiative:' || new.id::text,
      'initiative_created',
      'database',
      new.author_ref,
      'citizen',
      new.id,
      coalesce(new.created_at, now()),
      jsonb_build_object(
        'title', new.title,
        'category', new.category,
        'status', new.status,
        'authorName', new.author_name,
        'aiScore', new.ai_score,
        'aiRisk', new.ai_risk
      )
    )
    on conflict (external_id) do update
      set occurred_at = excluded.occurred_at,
          data = excluded.data;
  exception
    when others then
      null;
  end;

  return new;
end;
$$;

create or replace function public.analytics_record_initiative_status_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into public.analytics_events (
      event_type,
      source,
      user_ref,
      user_role,
      initiative_id,
      occurred_at,
      data
    )
    values (
      'initiative_status_changed',
      'database',
      new.author_ref,
      'citizen',
      new.id,
      now(),
      jsonb_build_object(
        'title', new.title,
        'category', new.category,
        'oldStatus', old.status,
        'newStatus', new.status
      )
    );
  exception
    when others then
      null;
  end;

  return new;
end;
$$;

create or replace function public.analytics_record_vote_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into public.analytics_events (
      external_id,
      event_type,
      source,
      user_ref,
      user_role,
      initiative_id,
      occurred_at,
      data
    )
    values (
      'vote:' || new.id::text,
      'vote_created',
      'database',
      new.voter_ref,
      case when new.voter_ref like 'anon-%' then 'anonymous' else 'citizen' end,
      new.initiative_id,
      coalesce(new.created_at, now()),
      jsonb_build_object(
        'voterName', new.voter_name,
        'anonymous', new.voter_ref like 'anon-%'
      )
    )
    on conflict (external_id) do update
      set user_ref = excluded.user_ref,
          user_role = excluded.user_role,
          initiative_id = excluded.initiative_id,
          occurred_at = excluded.occurred_at,
          data = excluded.data;
  exception
    when others then
      null;
  end;

  return new;
end;
$$;

create or replace function public.analytics_record_signature_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into public.analytics_events (
      external_id,
      event_type,
      source,
      user_ref,
      user_role,
      initiative_id,
      occurred_at,
      data
    )
    values (
      'signature:' || new.id::text,
      'signature_created',
      'database',
      new.signer_ref,
      'citizen',
      new.initiative_id,
      coalesce(new.created_at, now()),
      jsonb_build_object(
        'signerName', new.signer_name,
        'method', new.method
      )
    )
    on conflict (external_id) do update
      set user_ref = excluded.user_ref,
          initiative_id = excluded.initiative_id,
          occurred_at = excluded.occurred_at,
          data = excluded.data;
  exception
    when others then
      null;
  end;

  return new;
end;
$$;

create or replace function public.analytics_record_comment_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into public.analytics_events (
      external_id,
      event_type,
      source,
      user_ref,
      user_role,
      initiative_id,
      occurred_at,
      data
    )
    values (
      'comment:' || new.id::text,
      'comment_created',
      'database',
      new.author_ref,
      'citizen',
      new.initiative_id,
      coalesce(new.created_at, now()),
      jsonb_build_object(
        'authorName', new.author_name,
        'bodyLength', char_length(new.body)
      )
    )
    on conflict (external_id) do update
      set user_ref = excluded.user_ref,
          initiative_id = excluded.initiative_id,
          occurred_at = excluded.occurred_at,
          data = excluded.data;
  exception
    when others then
      null;
  end;

  return new;
end;
$$;

create or replace function public.analytics_record_ai_review_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into public.analytics_events (
      external_id,
      event_type,
      source,
      initiative_id,
      occurred_at,
      data
    )
    values (
      'ai_review:' || new.id::text,
      'ai_review_created',
      'database',
      new.initiative_id,
      coalesce(new.created_at, now()),
      jsonb_build_object(
        'provider', new.provider,
        'model', new.model,
        'score', new.score,
        'risk', new.risk,
        'suitability', new.suitability,
        'suggestedCategory', new.suggested_category
      )
    )
    on conflict (external_id) do update
      set initiative_id = excluded.initiative_id,
          occurred_at = excluded.occurred_at,
          data = excluded.data;
  exception
    when others then
      null;
  end;

  return new;
end;
$$;

drop trigger if exists analytics_initiatives_insert on public.initiatives;
create trigger analytics_initiatives_insert
after insert on public.initiatives
for each row
execute function public.analytics_record_initiative_created();

drop trigger if exists analytics_initiatives_status_update on public.initiatives;
create trigger analytics_initiatives_status_update
after update of status on public.initiatives
for each row
when (old.status is distinct from new.status)
execute function public.analytics_record_initiative_status_changed();

drop trigger if exists analytics_votes_insert on public.votes;
create trigger analytics_votes_insert
after insert on public.votes
for each row
execute function public.analytics_record_vote_created();

drop trigger if exists analytics_signatures_insert on public.signatures;
create trigger analytics_signatures_insert
after insert on public.signatures
for each row
execute function public.analytics_record_signature_created();

drop trigger if exists analytics_comments_insert on public.comments;
create trigger analytics_comments_insert
after insert on public.comments
for each row
execute function public.analytics_record_comment_created();

drop trigger if exists analytics_ai_reviews_insert on public.initiative_ai_reviews;
create trigger analytics_ai_reviews_insert
after insert on public.initiative_ai_reviews
for each row
execute function public.analytics_record_ai_review_created();

-- Backfill central event stream from existing rows.
insert into public.analytics_events (
  external_id,
  event_type,
  source,
  user_ref,
  user_role,
  session_id,
  path,
  initiative_id,
  occurred_at,
  data,
  created_at
)
select
  coalesce(nullif(data ->> 'id', ''), 'system:' || id::text),
  event_type,
  coalesce(nullif(source, ''), 'frontend'),
  nullif(user_ref, ''),
  nullif(user_role, ''),
  nullif(session_id, ''),
  nullif(path, ''),
  public.analytics_try_uuid(data ->> 'initiativeId'),
  created_at,
  data,
  created_at
from public.system_analytics_events
on conflict (external_id) do update
  set event_type = excluded.event_type,
      source = excluded.source,
      user_ref = excluded.user_ref,
      user_role = excluded.user_role,
      session_id = excluded.session_id,
      path = excluded.path,
      initiative_id = excluded.initiative_id,
      occurred_at = excluded.occurred_at,
      data = excluded.data;

insert into public.analytics_events (
  external_id,
  event_type,
  source,
  user_ref,
  user_role,
  initiative_id,
  occurred_at,
  data,
  created_at
)
select
  'initiative:' || id::text,
  'initiative_created',
  'database',
  author_ref,
  'citizen',
  id,
  created_at,
  jsonb_build_object(
    'title', title,
    'category', category,
    'status', status,
    'authorName', author_name,
    'aiScore', ai_score,
    'aiRisk', ai_risk
  ),
  created_at
from public.initiatives
on conflict (external_id) do nothing;

insert into public.analytics_events (
  external_id,
  event_type,
  source,
  user_ref,
  user_role,
  initiative_id,
  occurred_at,
  data,
  created_at
)
select
  'vote:' || id::text,
  'vote_created',
  'database',
  voter_ref,
  case when voter_ref like 'anon-%' then 'anonymous' else 'citizen' end,
  initiative_id,
  created_at,
  jsonb_build_object(
    'voterName', voter_name,
    'anonymous', voter_ref like 'anon-%'
  ),
  created_at
from public.votes
on conflict (external_id) do nothing;

insert into public.analytics_events (
  external_id,
  event_type,
  source,
  user_ref,
  user_role,
  initiative_id,
  occurred_at,
  data,
  created_at
)
select
  'signature:' || id::text,
  'signature_created',
  'database',
  signer_ref,
  'citizen',
  initiative_id,
  created_at,
  jsonb_build_object(
    'signerName', signer_name,
    'method', method
  ),
  created_at
from public.signatures
on conflict (external_id) do nothing;

insert into public.analytics_events (
  external_id,
  event_type,
  source,
  user_ref,
  user_role,
  initiative_id,
  occurred_at,
  data,
  created_at
)
select
  'comment:' || id::text,
  'comment_created',
  'database',
  author_ref,
  'citizen',
  initiative_id,
  created_at,
  jsonb_build_object(
    'authorName', author_name,
    'bodyLength', char_length(body)
  ),
  created_at
from public.comments
on conflict (external_id) do nothing;

insert into public.analytics_events (
  external_id,
  event_type,
  source,
  initiative_id,
  occurred_at,
  data,
  created_at
)
select
  'ai_review:' || id::text,
  'ai_review_created',
  'database',
  initiative_id,
  created_at,
  jsonb_build_object(
    'provider', provider,
    'model', model,
    'score', score,
    'risk', risk,
    'suitability', suitability,
    'suggestedCategory', suggested_category
  ),
  created_at
from public.initiative_ai_reviews
on conflict (external_id) do nothing;

create or replace view public.analytics_events_recent
with (security_invoker = true)
as
select
  id,
  external_id,
  event_type,
  source,
  user_ref,
  user_role,
  session_id,
  path,
  initiative_id,
  occurred_at,
  data
from public.analytics_events
order by occurred_at desc
limit 500;

create or replace view public.analytics_event_daily
with (security_invoker = true)
as
select
  occurred_at::date as metric_date,
  event_type,
  source,
  count(*)::int as event_count,
  count(distinct nullif(session_id, ''))::int as unique_sessions,
  count(distinct nullif(user_ref, ''))::int as unique_users,
  min(occurred_at) as first_event_at,
  max(occurred_at) as last_event_at
from public.analytics_events
group by occurred_at::date, event_type, source;

create or replace view public.analytics_ai_daily
with (security_invoker = true)
as
select
  occurred_at::date as metric_date,
  coalesce(nullif(data ->> 'provider', ''), 'unknown') as provider,
  count(*)::int as request_count,
  coalesce(sum(public.analytics_jsonb_number(data, 'estimatedTokens')), 0)::int as estimated_tokens,
  count(*) filter (where public.analytics_jsonb_boolean(data, 'fallback') is true)::int as fallback_count,
  round(avg(public.analytics_jsonb_number(data, 'durationMs')), 0)::int as average_duration_ms,
  round(avg(public.analytics_jsonb_number(data, 'score')), 1) as average_score
from public.analytics_events
where event_type in ('ai_review', 'ai_review_created')
group by occurred_at::date, coalesce(nullif(data ->> 'provider', ''), 'unknown');

create or replace view public.analytics_email_daily
with (security_invoker = true)
as
select
  occurred_at::date as metric_date,
  coalesce(nullif(data ->> 'mode', ''), 'unknown') as mode,
  count(*)::int as event_count,
  coalesce(sum(public.analytics_jsonb_number(data, 'count')), 0)::int as notification_count,
  count(*) filter (where public.analytics_jsonb_boolean(data, 'skipped') is true)::int as skipped_count
from public.analytics_events
where event_type = 'email_notifications'
group by occurred_at::date, coalesce(nullif(data ->> 'mode', ''), 'unknown');

create or replace view public.analytics_frontend_daily
with (security_invoker = true)
as
select
  occurred_at::date as metric_date,
  coalesce(nullif(data ->> 'dataSource', ''), source) as data_source,
  count(*)::int as data_load_count,
  coalesce(sum(public.analytics_jsonb_number(data, 'count')), 0)::int as loaded_items,
  round(avg(public.analytics_jsonb_number(data, 'durationMs')), 0)::int as average_duration_ms
from public.analytics_events
where event_type = 'data_load'
group by occurred_at::date, coalesce(nullif(data ->> 'dataSource', ''), source);

create or replace view public.analytics_business_event_daily
with (security_invoker = true)
as
select
  occurred_at::date as metric_date,
  event_type,
  count(*)::int as event_count,
  count(distinct initiative_id)::int as affected_initiatives,
  count(distinct nullif(user_ref, ''))::int as unique_actors
from public.analytics_events
where event_type in (
  'initiative_created',
  'initiative_status_changed',
  'vote_created',
  'signature_created',
  'comment_created',
  'ai_review_created'
)
group by occurred_at::date, event_type;

create or replace view public.analytics_initiative_summary
with (security_invoker = true)
as
select
  i.id,
  i.title,
  i.category,
  i.status,
  i.author_ref,
  i.author_name,
  coalesce(v.vote_count, 0) as vote_count,
  coalesce(s.signature_count, 0) as signature_count,
  coalesce(c.comment_count, 0) as comment_count,
  coalesce(v.vote_count, 0) + coalesce(s.signature_count, 0) as support_count,
  case
    when coalesce(v.vote_count, 0) = 0 then 0
    else round((coalesce(s.signature_count, 0)::numeric / coalesce(v.vote_count, 0)) * 100, 1)
  end as signature_conversion_percent,
  round((coalesce(v.vote_count, 0) + coalesce(s.signature_count, 0) + coalesce(c.comment_count, 0) * 0.5)::numeric, 1) as engagement_score,
  i.ai_score,
  i.ai_risk,
  greatest(
    i.updated_at,
    i.created_at,
    coalesce(v.last_vote_at, i.created_at),
    coalesce(s.last_signature_at, i.created_at),
    coalesce(c.last_comment_at, i.created_at)
  ) as latest_activity_at,
  i.created_at,
  i.updated_at
from public.initiatives i
left join (
  select initiative_id, count(*)::int as vote_count, max(created_at) as last_vote_at
  from public.votes
  group by initiative_id
) v on v.initiative_id = i.id
left join (
  select initiative_id, count(*)::int as signature_count, max(created_at) as last_signature_at
  from public.signatures
  group by initiative_id
) s on s.initiative_id = i.id
left join (
  select initiative_id, count(*)::int as comment_count, max(created_at) as last_comment_at
  from public.comments
  group by initiative_id
) c on c.initiative_id = i.id;

create or replace view public.analytics_category_summary
with (security_invoker = true)
as
select
  category,
  count(*)::int as initiative_count,
  sum(vote_count)::int as vote_count,
  sum(signature_count)::int as signature_count,
  sum(comment_count)::int as comment_count,
  sum(support_count)::int as support_count,
  round(avg(ai_score), 1) as average_ai_score,
  round(avg(engagement_score), 1) as average_engagement_score
from public.analytics_initiative_summary
group by category;

create or replace view public.analytics_system_summary
with (security_invoker = true)
as
with participant_refs as (
  select author_ref as ref from public.initiatives
  union all
  select voter_ref from public.votes
  union all
  select signer_ref from public.signatures
  union all
  select author_ref from public.comments
),
clean_participants as (
  select distinct nullif(btrim(ref), '') as ref
  from participant_refs
  where nullif(btrim(ref), '') is not null
)
select
  (select count(*)::int from public.initiatives) as initiative_rows,
  (select count(*)::int from public.votes) as vote_rows,
  (select count(*)::int from public.signatures) as signature_rows,
  (select count(*)::int from public.comments) as comment_rows,
  (select count(*)::int from public.initiative_ai_reviews) as stored_ai_review_rows,
  (select count(*)::int from public.analytics_events) as analytics_event_rows,
  (select count(*)::int from public.analytics_events where event_type = 'ai_review') as ai_request_events,
  (
    select coalesce(sum(public.analytics_jsonb_number(data, 'estimatedTokens')), 0)::int
    from public.analytics_events
    where event_type = 'ai_review'
  ) as ai_estimated_tokens,
  (
    select count(*)::int
    from public.analytics_events
    where event_type = 'ai_review'
      and public.analytics_jsonb_boolean(data, 'fallback') is true
  ) as ai_fallback_events,
  (select count(*)::int from public.analytics_events where event_type = 'email_notifications') as email_events,
  (
    select coalesce(sum(public.analytics_jsonb_number(data, 'count')), 0)::int
    from public.analytics_events
    where event_type = 'email_notifications'
  ) as email_notification_items,
  (select count(distinct nullif(session_id, ''))::int from public.analytics_events) as unique_sessions,
  (select count(*)::int from clean_participants) as unique_participants,
  (select count(*)::int from clean_participants where ref like 'anon-%') as anonymous_participants,
  (select count(*)::int from clean_participants where ref not like 'anon-%') as registered_participants,
  (select count(*)::int from public.votes where voter_ref like 'anon-%') as anonymous_vote_rows,
  (
    select count(*)::int
    from public.initiatives
    where status in ('active', 'signature_collection')
  ) as public_initiative_rows;

create or replace function public.refresh_analytics_daily_snapshots(
  p_start_date date default current_date - 30,
  p_end_date date default current_date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_rows integer;
begin
  if p_start_date is null or p_end_date is null or p_start_date > p_end_date then
    raise exception 'Invalid analytics snapshot date range.';
  end if;

  insert into public.analytics_daily_snapshots (
    snapshot_date,
    initiative_count,
    vote_count,
    signature_count,
    comment_count,
    stored_ai_review_count,
    system_event_count,
    ai_event_count,
    ai_estimated_tokens,
    ai_fallback_count,
    email_event_count,
    email_notification_count,
    anonymous_vote_count,
    unique_session_count,
    unique_participant_count,
    public_initiative_count,
    status_breakdown,
    category_breakdown,
    event_type_breakdown,
    generated_at
  )
  with days as (
    select generate_series(p_start_date, p_end_date, interval '1 day')::date as snapshot_date
  )
  select
    d.snapshot_date,
    (select count(*)::int from public.initiatives i where i.created_at < (d.snapshot_date + 1)::timestamptz),
    (select count(*)::int from public.votes v where v.created_at < (d.snapshot_date + 1)::timestamptz),
    (select count(*)::int from public.signatures s where s.created_at < (d.snapshot_date + 1)::timestamptz),
    (select count(*)::int from public.comments c where c.created_at < (d.snapshot_date + 1)::timestamptz),
    (select count(*)::int from public.initiative_ai_reviews r where r.created_at < (d.snapshot_date + 1)::timestamptz),
    (
      select count(*)::int
      from public.analytics_events e
      where e.occurred_at >= d.snapshot_date::timestamptz
        and e.occurred_at < (d.snapshot_date + 1)::timestamptz
    ),
    (
      select count(*)::int
      from public.analytics_events e
      where e.event_type in ('ai_review', 'ai_review_created')
        and e.occurred_at >= d.snapshot_date::timestamptz
        and e.occurred_at < (d.snapshot_date + 1)::timestamptz
    ),
    (
      select coalesce(sum(public.analytics_jsonb_number(e.data, 'estimatedTokens')), 0)::int
      from public.analytics_events e
      where e.event_type = 'ai_review'
        and e.occurred_at >= d.snapshot_date::timestamptz
        and e.occurred_at < (d.snapshot_date + 1)::timestamptz
    ),
    (
      select count(*)::int
      from public.analytics_events e
      where e.event_type = 'ai_review'
        and public.analytics_jsonb_boolean(e.data, 'fallback') is true
        and e.occurred_at >= d.snapshot_date::timestamptz
        and e.occurred_at < (d.snapshot_date + 1)::timestamptz
    ),
    (
      select count(*)::int
      from public.analytics_events e
      where e.event_type = 'email_notifications'
        and e.occurred_at >= d.snapshot_date::timestamptz
        and e.occurred_at < (d.snapshot_date + 1)::timestamptz
    ),
    (
      select coalesce(sum(public.analytics_jsonb_number(e.data, 'count')), 0)::int
      from public.analytics_events e
      where e.event_type = 'email_notifications'
        and e.occurred_at >= d.snapshot_date::timestamptz
        and e.occurred_at < (d.snapshot_date + 1)::timestamptz
    ),
    (select count(*)::int from public.votes v where v.voter_ref like 'anon-%' and v.created_at < (d.snapshot_date + 1)::timestamptz),
    (
      select count(distinct nullif(e.session_id, ''))::int
      from public.analytics_events e
      where e.occurred_at >= d.snapshot_date::timestamptz
        and e.occurred_at < (d.snapshot_date + 1)::timestamptz
    ),
    (
      select count(distinct ref)::int
      from (
        select nullif(btrim(i.author_ref), '') as ref
        from public.initiatives i
        where i.created_at < (d.snapshot_date + 1)::timestamptz
        union all
        select nullif(btrim(v.voter_ref), '') as ref
        from public.votes v
        where v.created_at < (d.snapshot_date + 1)::timestamptz
        union all
        select nullif(btrim(s.signer_ref), '') as ref
        from public.signatures s
        where s.created_at < (d.snapshot_date + 1)::timestamptz
        union all
        select nullif(btrim(c.author_ref), '') as ref
        from public.comments c
        where c.created_at < (d.snapshot_date + 1)::timestamptz
      ) participants
      where ref is not null
    ),
    (
      select count(*)::int
      from public.initiatives i
      where i.status in ('active', 'signature_collection')
        and i.created_at < (d.snapshot_date + 1)::timestamptz
    ),
    coalesce((
      select jsonb_agg(
        jsonb_build_object('status', status, 'count', count)
        order by status
      )
      from (
        select i.status::text as status, count(*)::int as count
        from public.initiatives i
        where i.created_at < (d.snapshot_date + 1)::timestamptz
        group by i.status
      ) statuses
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'category', category,
          'initiatives', initiatives,
          'votes', votes,
          'comments', comments
        )
        order by initiatives desc, category
      )
      from (
        select
          i.category::text as category,
          count(distinct i.id)::int as initiatives,
          count(distinct v.id)::int as votes,
          count(distinct c.id)::int as comments
        from public.initiatives i
        left join public.votes v
          on v.initiative_id = i.id
          and v.created_at < (d.snapshot_date + 1)::timestamptz
        left join public.comments c
          on c.initiative_id = i.id
          and c.created_at < (d.snapshot_date + 1)::timestamptz
        where i.created_at < (d.snapshot_date + 1)::timestamptz
        group by i.category
      ) categories
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(
        jsonb_build_object('type', event_type, 'count', count)
        order by count desc, event_type
      )
      from (
        select e.event_type, count(*)::int as count
        from public.analytics_events e
        where e.occurred_at >= d.snapshot_date::timestamptz
          and e.occurred_at < (d.snapshot_date + 1)::timestamptz
        group by e.event_type
      ) events
    ), '[]'::jsonb),
    now()
  from days d
  on conflict (snapshot_date) do update
    set initiative_count = excluded.initiative_count,
        vote_count = excluded.vote_count,
        signature_count = excluded.signature_count,
        comment_count = excluded.comment_count,
        stored_ai_review_count = excluded.stored_ai_review_count,
        system_event_count = excluded.system_event_count,
        ai_event_count = excluded.ai_event_count,
        ai_estimated_tokens = excluded.ai_estimated_tokens,
        ai_fallback_count = excluded.ai_fallback_count,
        email_event_count = excluded.email_event_count,
        email_notification_count = excluded.email_notification_count,
        anonymous_vote_count = excluded.anonymous_vote_count,
        unique_session_count = excluded.unique_session_count,
        unique_participant_count = excluded.unique_participant_count,
        public_initiative_count = excluded.public_initiative_count,
        status_breakdown = excluded.status_breakdown,
        category_breakdown = excluded.category_breakdown,
        event_type_breakdown = excluded.event_type_breakdown,
        generated_at = excluded.generated_at,
        updated_at = now();

  get diagnostics affected_rows = row_count;
  return affected_rows;
end;
$$;

revoke all on public.system_analytics_events from public, anon, authenticated;
revoke all on public.analytics_events from public, anon, authenticated;
revoke all on public.analytics_clarity_snapshots from public, anon, authenticated;
revoke all on public.analytics_daily_snapshots from public, anon, authenticated;

revoke all on public.analytics_events_recent from public, anon, authenticated;
revoke all on public.analytics_event_daily from public, anon, authenticated;
revoke all on public.analytics_ai_daily from public, anon, authenticated;
revoke all on public.analytics_email_daily from public, anon, authenticated;
revoke all on public.analytics_frontend_daily from public, anon, authenticated;
revoke all on public.analytics_business_event_daily from public, anon, authenticated;
revoke all on public.analytics_initiative_summary from public, anon, authenticated;
revoke all on public.analytics_category_summary from public, anon, authenticated;
revoke all on public.analytics_system_summary from public, anon, authenticated;

revoke execute on function public.analytics_set_updated_at() from public, anon, authenticated;
revoke execute on function public.analytics_try_uuid(text) from public, anon, authenticated;
revoke execute on function public.analytics_jsonb_number(jsonb, text) from public, anon, authenticated;
revoke execute on function public.analytics_jsonb_boolean(jsonb, text) from public, anon, authenticated;
revoke execute on function public.analytics_sync_system_event() from public, anon, authenticated;
revoke execute on function public.analytics_record_initiative_created() from public, anon, authenticated;
revoke execute on function public.analytics_record_initiative_status_changed() from public, anon, authenticated;
revoke execute on function public.analytics_record_vote_created() from public, anon, authenticated;
revoke execute on function public.analytics_record_signature_created() from public, anon, authenticated;
revoke execute on function public.analytics_record_comment_created() from public, anon, authenticated;
revoke execute on function public.analytics_record_ai_review_created() from public, anon, authenticated;
revoke execute on function public.refresh_analytics_daily_snapshots(date, date) from public, anon, authenticated;

grant all on public.system_analytics_events to service_role;
grant all on public.analytics_events to service_role;
grant all on public.analytics_clarity_snapshots to service_role;
grant all on public.analytics_daily_snapshots to service_role;

grant select on public.analytics_events_recent to service_role;
grant select on public.analytics_event_daily to service_role;
grant select on public.analytics_ai_daily to service_role;
grant select on public.analytics_email_daily to service_role;
grant select on public.analytics_frontend_daily to service_role;
grant select on public.analytics_business_event_daily to service_role;
grant select on public.analytics_initiative_summary to service_role;
grant select on public.analytics_category_summary to service_role;
grant select on public.analytics_system_summary to service_role;

grant execute on function public.analytics_try_uuid(text) to service_role;
grant execute on function public.analytics_jsonb_number(jsonb, text) to service_role;
grant execute on function public.analytics_jsonb_boolean(jsonb, text) to service_role;
grant execute on function public.refresh_analytics_daily_snapshots(date, date) to service_role;

-- Optional after the first run:
-- select public.refresh_analytics_daily_snapshots(current_date - 30, current_date);
