
create extension if not exists pg_trgm;

create or replace function public.search_normalize(value text)
returns text
language sql
immutable
parallel safe
as $$
  select regexp_replace(
    translate(
      lower(coalesce(value, '')),
      U&'\010D\0107\0161\017E\0111\00E1\00E0\00E4\00E2\00E9\00E8\00EB\00EA\00ED\00EC\00EF\00EE\00F3\00F2\00F6\00F4\00FA\00F9\00FC\00FB\00F1',
      'ccszdaaaaeeeeiiiioooouuuun'
    ),
    '[^a-z0-9 ]+',
    ' ',
    'g'
  );
$$;

create or replace function public.initiative_search_text(
  title text,
  summary text,
  category text,
  description text,
  legal_reference text,
  expected_impact text
)
returns text
language sql
immutable
parallel safe
as $$
  select public.search_normalize(
    concat_ws(
      ' ',
      repeat(coalesce(title, '') || ' ', 4),
      repeat(coalesce(summary, '') || ' ', 2),
      repeat(coalesce(category, '') || ' ', 2),
      coalesce(description, ''),
      coalesce(legal_reference, ''),
      coalesce(expected_impact, '')
    )
  );
$$;

create or replace function public.initiative_category_label(value public.initiative_category)
returns text
language sql
immutable
parallel safe
as $$
  select coalesce(value::text, '');
$$;

create or replace function public.initiative_status_label(value public.initiative_status)
returns text
language sql
immutable
parallel safe
as $$
  select coalesce(value::text, '');
$$;

create index if not exists initiatives_search_tsv_idx
  on public.initiatives
  using gin (
    to_tsvector(
      'simple',
      public.initiative_search_text(
        title,
        summary,
        public.initiative_category_label(category),
        description,
        legal_reference,
        expected_impact
      )
    )
  );

create index if not exists initiatives_search_trgm_idx
  on public.initiatives
  using gin (
    public.initiative_search_text(
      title,
      summary,
      public.initiative_category_label(category),
      description,
      legal_reference,
      expected_impact
    ) gin_trgm_ops
  );

create or replace function public.search_initiatives(
  p_query text default '',
  p_category text default null,
  p_status text default null,
  p_public_only boolean default false,
  p_sort text default 'relevance',
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  title text,
  summary text,
  description text,
  category text,
  legal_reference text,
  expected_impact text,
  status text,
  author_ref text,
  author_name text,
  ai_score integer,
  ai_risk text,
  ai_findings jsonb,
  ai_checks jsonb,
  ai_reviewed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  vote_count integer,
  signature_count integer,
  comment_count integer,
  support_count integer,
  latest_activity_at timestamptz,
  text_rank numeric,
  fuzzy_rank numeric,
  support_rank numeric,
  recency_rank numeric,
  search_score numeric,
  match_type text
)
language sql
stable
security invoker
set search_path = public
as $$
  with params as (
    select
      public.search_normalize(p_query) as query_text,
      nullif(btrim(coalesce(p_category, '')), '') as category_filter,
      nullif(btrim(coalesce(p_status, '')), '') as status_filter,
      coalesce(p_public_only, false) as public_only,
      lower(coalesce(nullif(btrim(p_sort), ''), 'relevance')) as sort_mode,
      least(100, greatest(1, coalesce(p_limit, 20))) as row_limit,
      greatest(0, coalesce(p_offset, 0)) as row_offset
  ),
  search_params as (
    select
      *,
      length(query_text) as query_length,
      case
        when query_text = '' or length(query_text) < 2 then null
        else websearch_to_tsquery('simple', query_text)
      end as ts_query
    from params
  ),
  base_rows as (
    select
      i.*,
      public.initiative_search_text(
        i.title,
        i.summary,
        public.initiative_category_label(i.category),
        i.description,
        i.legal_reference,
        i.expected_impact
      ) as search_text,
      coalesce(v.vote_count, 0) as vote_count,
      coalesce(s.signature_count, 0) as signature_count,
      coalesce(c.comment_count, 0) as comment_count,
      coalesce(v.vote_count, 0) + coalesce(s.signature_count, 0) as support_count,
      greatest(
        i.updated_at,
        i.created_at,
        coalesce(v.last_vote_at, i.created_at),
        coalesce(s.last_signature_at, i.created_at),
        coalesce(c.last_comment_at, i.created_at)
      ) as latest_activity_at
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
    ) c on c.initiative_id = i.id
    cross join search_params p
    where (p.category_filter is null or p.category_filter = 'all' or public.initiative_category_label(i.category) = p.category_filter)
      and (p.status_filter is null or p.status_filter = 'all' or public.initiative_status_label(i.status) = p.status_filter)
      and (not p.public_only or public.initiative_status_label(i.status) in ('active', 'signature_collection'))
  ),
  ranked_rows as (
    select
      b.*,
      p.query_text,
      p.ts_query,
      p.query_length,
      p.sort_mode,
      p.row_limit,
      p.row_offset,
      max(b.support_count) over () as max_support_count,
      case
        when p.ts_query is null then 0::numeric
        else ts_rank_cd(to_tsvector('simple', b.search_text), p.ts_query, 32)::numeric
      end as text_rank_value,
      case
        when p.query_text = '' or p.query_length < 2 then 0::numeric
        else greatest(
          similarity(public.search_normalize(b.title), p.query_text),
          word_similarity(p.query_text, public.search_normalize(b.title)) * 0.95,
          similarity(public.search_normalize(public.initiative_category_label(b.category)), p.query_text) * 0.80,
          word_similarity(p.query_text, public.search_normalize(public.initiative_category_label(b.category))) * 0.75
        )::numeric
      end as fuzzy_rank_value
    from base_rows b
    cross join search_params p
  ),
  matched_rows as (
    select
      r.*,
      case
        when r.max_support_count > 0 then (r.support_count::numeric / r.max_support_count::numeric)
        else 0::numeric
      end as support_rank_value,
      greatest(
        0::numeric,
        least(
          1::numeric,
          1::numeric - (extract(epoch from (now() - r.latest_activity_at))::numeric / (86400::numeric * 120::numeric))
        )
      ) as recency_rank_value
    from ranked_rows r
    where r.query_text = ''
      or (
        r.query_length >= 2
        and (
          (r.ts_query is not null and to_tsvector('simple', r.search_text) @@ r.ts_query)
          or public.search_normalize(r.title) like r.query_text || '%'
          or public.search_normalize(public.initiative_category_label(r.category)) like r.query_text || '%'
          or (
            r.query_length >= 3
            and (
              public.search_normalize(r.title) like '%' || r.query_text || '%'
              or public.search_normalize(r.summary) like '%' || r.query_text || '%'
              or public.search_normalize(public.initiative_category_label(r.category)) like '%' || r.query_text || '%'
              or r.fuzzy_rank_value >= case when r.query_length <= 3 then 0.42 else 0.32 end
            )
          )
        )
      )
  ),
  scored_rows as (
    select
      m.*,
      (
        m.text_rank_value * 0.58
        + m.fuzzy_rank_value * 0.28
        + m.support_rank_value * 0.10
        + m.recency_rank_value * 0.04
        + case
            when m.query_text <> '' and public.search_normalize(m.title) = m.query_text then 0.30
            when m.query_text <> '' and public.search_normalize(m.title) like m.query_text || '%' then 0.18
            else 0
          end
      )::numeric as search_score_value,
      case
        when m.query_text = '' then 'all'
        when public.search_normalize(m.title) = m.query_text then 'exact_title'
        when public.search_normalize(m.title) like m.query_text || '%' then 'title_prefix'
        when m.ts_query is not null and to_tsvector('simple', m.search_text) @@ m.ts_query then 'full_text'
        when public.search_normalize(m.title) like '%' || m.query_text || '%'
          or public.search_normalize(m.summary) like '%' || m.query_text || '%'
          or public.search_normalize(public.initiative_category_label(m.category)) like '%' || m.query_text || '%'
          then 'substring'
        else 'fuzzy'
      end as match_type_value
    from matched_rows m
  )
  select
    s.id,
    s.title,
    s.summary,
    s.description,
    public.initiative_category_label(s.category),
    s.legal_reference,
    s.expected_impact,
    public.initiative_status_label(s.status),
    s.author_ref,
    s.author_name,
    s.ai_score,
    s.ai_risk::text,
    s.ai_findings,
    s.ai_checks,
    s.ai_reviewed_at,
    s.created_at,
    s.updated_at,
    s.vote_count,
    s.signature_count,
    s.comment_count,
    s.support_count,
    s.latest_activity_at,
    round(s.text_rank_value, 4),
    round(s.fuzzy_rank_value, 4),
    round(s.support_rank_value, 4),
    round(s.recency_rank_value, 4),
    round(s.search_score_value, 4),
    s.match_type_value
  from scored_rows s
  order by
    case when s.sort_mode = 'newest' then extract(epoch from s.created_at) end desc nulls last,
    case when s.sort_mode = 'score' then s.ai_score end desc nulls last,
    case when s.sort_mode = 'popular' then s.support_count end desc nulls last,
    case when s.sort_mode = 'popular' then s.created_at end desc nulls last,
    s.search_score_value desc,
    s.support_count desc,
    s.created_at desc,
    s.title asc
  limit (select row_limit from search_params)
  offset (select row_offset from search_params);
$$;

create or replace function public.search_initiative_suggestions(
  p_query text default '',
  p_public_only boolean default false,
  p_limit integer default 8
)
returns table (
  id uuid,
  title text,
  category text,
  status text,
  summary text,
  support_count integer,
  search_score numeric,
  match_type text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    result.id,
    result.title,
    result.category,
    result.status,
    result.summary,
    result.support_count,
    result.search_score,
    result.match_type
  from public.search_initiatives(
    p_query,
    null,
    null,
    p_public_only,
    'relevance',
    least(20, greatest(1, coalesce(p_limit, 8))),
    0
  ) result;
$$;

grant execute on function public.search_initiatives(text, text, text, boolean, text, integer, integer) to anon, authenticated;
grant execute on function public.search_initiative_suggestions(text, boolean, integer) to anon, authenticated;

