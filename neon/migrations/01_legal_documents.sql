begin;

create table if not exists legal_documents (
  key text primary key,
  version text not null,
  title text not null,
  url text not null,
  published_at timestamptz not null default now()
);

insert into legal_documents(key, version, title, url)
values
 ('terms','2025-10-26','Terms of Service','/legal/terms'),
 ('privacy','2025-10-26','Privacy Policy','/legal/privacy'),
 ('cookies','2025-10-26','Cookie Policy','/legal/cookies')
on conflict (key) do update
set version = excluded.version,
    title   = excluded.title,
    url     = excluded.url;

commit;
