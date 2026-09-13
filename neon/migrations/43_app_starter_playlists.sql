-- Optional editorial overrides for the bundled app onboarding samples.
-- Existing playlist contents and user generation records are never changed.
INSERT INTO playlists (slug, name, description, is_public)
VALUES
  ('starter-image', 'Starter · Image', 'Creative samples for newcomers in the Image workspace. Empty uses the bundled selection.', TRUE),
  ('starter-audio', 'Starter · Audio', 'Audio samples for newcomers. Empty uses the bundled voice selection.', TRUE)
ON CONFLICT (slug) DO NOTHING;
