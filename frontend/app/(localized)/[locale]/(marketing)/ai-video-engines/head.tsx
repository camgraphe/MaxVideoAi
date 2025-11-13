import { SEO } from '@/components/SEO';

export default function Head() {
  const canonical = 'https://maxvideoai.com/ai-video-engines';
  const title = 'AI Video Engines — Compare Sora, Veo, and Pika | MaxVideoAI';
  const description =
    'Compare AI video generators like Sora 2, Veo 3, and Pika. Run cinematic models in Europe via MaxVideoAI.';
  return (
    <>
      <SEO title={title} description={description} canonical={canonical} ogType="article" />
      <meta
        name="keywords"
        content="AI video generator, Sora 2, Veo 3, Pika 2.2, text-to-video Europe, Fal.ai, MaxVideoAI"
      />
      <meta property="og:topic" content="AI video generator comparison" />
    </>
  );
}
