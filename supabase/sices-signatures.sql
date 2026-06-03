alter table public.signatures
add column if not exists sices_request_id text,
add column if not exists sices_ces_id text,
add column if not exists signed_document_path text,
add column if not exists signed_document_hash text,
add column if not exists certificate_chain jsonb,
add column if not exists signature_status text;

create index if not exists signatures_sices_request_id_idx
on public.signatures(sices_request_id);
