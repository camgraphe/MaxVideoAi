begin;

create table if not exists user_consents (
  id bigserial primary key,
  user_id uuid not null,
  doc_key text not null,
  doc_version text not null,
  accepted boolean not null default true,
  accepted_at timestamptz not null default now(),
  ip inet,
  user_agent text,
  locale text,
  source text,
  constraint user_consents_unique unique (user_id, doc_key, doc_version)
);

create index if not exists idx_user_consents_user on user_consents(user_id);
create index if not exists idx_user_consents_doc on user_consents(doc_key);

commit;
