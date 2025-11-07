export default function Head() {
  const canonical = 'https://maxvideoai.com/ai-video-engines';
  return (
    <>
      <title>AI Video Engines — Compare Sora, Veo, and Pika | MaxVideoAI</title>
      <meta
        name="description"
        content="Compare AI video generators like Sora 2, Veo 3, and Pika. Run cinematic models in Europe via MaxVideoAI."
      />
      <meta
        name="keywords"
        content="AI video generator, Sora 2, Veo 3, Pika 2.2, text-to-video Europe, Fal.ai, MaxVideoAI"
      />
      <meta property="og:type" content="article" />
      <meta property="og:topic" content="AI video generator comparison" />
      <link rel="canonical" href={canonical} />
    </>
  );
}
