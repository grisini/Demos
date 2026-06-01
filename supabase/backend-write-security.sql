-- Production hardening for writes that must go through backend endpoints.
-- Run this after supabase/schema.sql in environments where Vercel/server endpoints
-- use SUPABASE_SERVICE_ROLE_KEY.

drop policy if exists "prototype insert initiatives" on initiatives;
drop policy if exists "prototype update initiatives" on initiatives;
drop policy if exists "prototype insert comments" on comments;

revoke insert, update, delete on initiatives from anon, authenticated;
revoke insert, update, delete on comments from anon, authenticated;

grant select on initiatives to anon, authenticated;
grant select on comments to anon, authenticated;

grant insert, select, update, delete on initiatives to service_role;
grant insert, select, update, delete on comments to service_role;
