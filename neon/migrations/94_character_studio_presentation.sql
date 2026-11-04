-- Editable casting notes are distinct from the immutable recipe of each render.
ALTER TABLE character_studio_characters
  ADD COLUMN IF NOT EXISTS presentation jsonb NOT NULL DEFAULT '{}'::jsonb
  CHECK (jsonb_typeof(presentation) = 'object');
