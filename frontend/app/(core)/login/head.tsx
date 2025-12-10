const DESCRIPTION =
  "Create your MaxVideoAI workspace account to generate videos with Sora, Veo, Pika, Kling and more. Sign in, manage credits, and keep every render in one hub.";

export default function Head() {
  return (
    <>
      <title>MaxVideoAI — Log in</title>
      <meta name="description" content={DESCRIPTION} />
      <meta property="og:description" content={DESCRIPTION} />
      <meta name="twitter:description" content={DESCRIPTION} />
      <meta name="robots" content="noindex, nofollow" />
      <link rel="canonical" href="https://maxvideoai.com/login" />
    </>
  );
}
