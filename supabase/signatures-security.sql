-- Harden SI-PASS signatures.
-- Run this after supabase/schema.sql in environments where signatures must be created
-- only by the backend endpoint using SUPABASE_SERVICE_ROLE_KEY.

drop policy if exists "prototype insert signatures" on signatures;

-- Public clients may still read signatures for counts/display, but they can no longer
-- insert forged rows through the anon key. The backend service role bypasses RLS.
revoke insert on signatures from anon, authenticated;
grant select on signatures to anon, authenticated;
grant insert, select, update, delete on signatures to service_role;
