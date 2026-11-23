-- One issuance counter per account. No audio, transcripts or provider keys are persisted.
CREATE TABLE IF NOT EXISTS dictation_session_windows (
  user_id uuid PRIMARY KEY,
  window_start timestamptz NOT NULL,
  sessions integer NOT NULL CHECK (sessions > 0)
);
