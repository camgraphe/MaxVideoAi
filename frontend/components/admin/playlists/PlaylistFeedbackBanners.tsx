type PlaylistFeedbackBannersProps = {
  error: string | null;
  feedback: string | null;
};

export function PlaylistFeedbackBanners({ error, feedback }: PlaylistFeedbackBannersProps) {
  return (
    <>
      {feedback ? (
        <div className="rounded-card border border-success-border bg-success-bg px-4 py-3 text-sm text-success">{feedback}</div>
      ) : null}
      {error ? (
        <div className="rounded-card border border-error-border bg-error-bg px-4 py-3 text-sm text-error">{error}</div>
      ) : null}
    </>
  );
}
