-- Optional editorial opening. Existing destinations retain their current order.
ALTER TABLE playlist_curations ADD COLUMN IF NOT EXISTS opening_ids text[];
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='playlist_curations'::regclass AND conname='playlist_opening_four_slots') THEN
    ALTER TABLE playlist_curations ADD CONSTRAINT playlist_opening_four_slots
      CHECK (opening_ids IS NULL OR (cardinality(opening_ids) = 4 AND array_position(opening_ids, NULL) IS NULL));
  END IF;
END $$;
