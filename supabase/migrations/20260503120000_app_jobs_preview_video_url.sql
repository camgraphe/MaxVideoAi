ALTER TABLE app_jobs
  ADD COLUMN IF NOT EXISTS preview_video_url TEXT;
