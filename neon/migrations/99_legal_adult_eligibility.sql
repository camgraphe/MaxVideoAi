-- Apply with the 18+ application release, to the explicitly selected database only.
-- Existing consent records are evidence: never rewrite them as an 18+ acceptance.
begin;

insert into legal_documents (key, version, title, url, published_at)
values
  ('terms', '2026-11-11', 'Terms of Service', '/legal/terms', now()),
  ('privacy', '2026-11-11', 'Privacy Policy', '/legal/privacy', now())
on conflict (key) do update
set version = excluded.version,
    published_at = excluded.published_at
where legal_documents.version < excluded.version;

commit;
