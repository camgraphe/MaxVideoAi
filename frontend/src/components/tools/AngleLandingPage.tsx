import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Play } from 'lucide-react';
import { ToolMarketingPage } from '@/components/tools/ToolMarketingPage';

const ANGLE_SOURCE_URL =
  'https://videohub-uploads-us.s3.amazonaws.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/d49ec543-8b71-42bb-aa7e-ce5289e28187.webp';
const ANGLE_OUTPUT_URL =
  'https://videohub-uploads-us.s3.amazonaws.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/44d08767-2bba-4ece-9e37-00991db207af.webp';
const ANGLE_ALT_THREE_URL =
  'https://videohub-uploads-us.s3.amazonaws.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/79fe6fd7-60cf-4419-a143-a2cb52e9b762.webp';
const ANGLE_ALT_FOUR_URL =
  'https://videohub-uploads-us.s3.amazonaws.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/cf9ff473-5f6f-4877-b5fd-aafc36bddeb8.webp';

function AngleShot({
  src,
  alt,
  label,
}: {
  src: string;
  alt: string;
  label: string;
}) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-hairline bg-white">
      <div className="relative aspect-[4/3] bg-[#edf3f8]">
        <Image src={src} alt={alt} fill sizes="220px" className="object-cover" />
      </div>
      <div className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">{label}</div>
    </div>
  );
}

function ProductAngleMock() {
  return (
    <div className="rounded-[18px] border border-hairline bg-[linear-gradient(180deg,#f5f8fb,#ffffff)] p-3">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,0.75fr)_auto_minmax(0,1fr)] sm:items-center">
        <div className="rounded-[16px] border border-hairline bg-white p-4">
          <div className="mx-auto h-24 w-16 rounded-[18px] bg-[linear-gradient(180deg,#334155,#0f172a)] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]" />
          <div className="mt-3 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">Front angle</div>
        </div>
        <ArrowRight className="mx-auto h-4 w-4 text-brand" />
        <div className="rounded-[16px] border border-hairline bg-white p-4">
          <div className="mx-auto h-24 w-16 origin-bottom-left rotate-[-10deg] rounded-[18px] bg-[linear-gradient(180deg,#1d4ed8,#0f172a)] shadow-[18px_0_24px_rgba(15,23,42,0.16)]" />
          <div className="mt-3 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">3/4 product view</div>
        </div>
      </div>
    </div>
  );
}

function AngleHeroVisual() {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)]">
        <div className="rounded-[26px] border border-white/70 bg-[linear-gradient(160deg,rgba(245,250,255,0.95),rgba(255,255,255,0.92))] p-4 shadow-card">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Source image</div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-[20px] bg-[#eaf1f7]">
            <Image
              src={ANGLE_SOURCE_URL}
              alt="Source image used to generate alternate camera angles."
              fill
              sizes="(max-width: 1024px) 100vw, 320px"
              className="object-cover"
            />
          </div>
        </div>

        <div className="rounded-[26px] border border-white/70 bg-[linear-gradient(160deg,rgba(255,255,255,0.96),rgba(235,243,249,0.92))] p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
            <span>Alternative angles</span>
            <span>4 views</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <AngleShot src={ANGLE_OUTPUT_URL} alt="AI-generated low-angle version of the source image." label="Low angle" />
            <AngleShot src={ANGLE_ALT_THREE_URL} alt="AI-generated 3/4 perspective from the same source image." label="3/4 view" />
            <AngleShot src={ANGLE_ALT_FOUR_URL} alt="AI-generated side-oriented perspective for the same image." label="Top-down feel" />
            <AngleShot src={ANGLE_SOURCE_URL} alt="Source image reused as a neutral eye-level comparison." label="Eye level" />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <div className="rounded-[26px] border border-white/70 bg-[linear-gradient(160deg,rgba(17,24,39,0.95),rgba(38,58,84,0.98))] p-4 text-white shadow-card">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Selected angle into motion</div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,0.78fr)_auto_minmax(0,1fr)] sm:items-center">
            <div className="rounded-[18px] border border-white/10 bg-white/6 p-3">
              <div className="relative aspect-[4/3] overflow-hidden rounded-[14px]">
                <Image
                  src={ANGLE_OUTPUT_URL}
                  alt="Selected camera angle prepared as a first frame for image-to-video."
                  fill
                  sizes="260px"
                  className="object-cover"
                />
              </div>
            </div>
            <div className="flex justify-center text-slate-300">
              <ArrowRight className="h-5 w-5" />
            </div>
            <div className="rounded-[18px] border border-white/10 bg-white/8 p-3">
              <div className="relative aspect-[16/10] overflow-hidden rounded-[14px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.16),transparent_55%),linear-gradient(135deg,rgba(14,116,144,0.34),rgba(29,78,216,0.18))]">
                <Image
                  src={ANGLE_OUTPUT_URL}
                  alt="Motion-ready thumbnail using the chosen AI camera angle."
                  fill
                  sizes="320px"
                  className="object-cover opacity-85"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#111827] via-transparent to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-full border border-white/15 bg-black/35 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white">
                  <span>Video-ready first frame</span>
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-900">
                    <Play className="h-4 w-4 fill-current" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[26px] border border-white/70 bg-[linear-gradient(160deg,rgba(245,249,252,0.96),rgba(255,255,255,0.9))] p-4 shadow-card">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Product / ecommerce example</div>
          <ProductAngleMock />
        </div>
      </div>
    </div>
  );
}

export function AngleLandingPage() {
  return (
    <ToolMarketingPage
      canonicalPath="/tools/angle"
      breadcrumbTitle="Change Camera Angle with AI"
      productLabel="Angle / Perspective"
      title="Change Camera Angle with AI"
      intro="Generate new viewpoints from a single image, explore perspective quickly, and create stronger first frames for image-to-video workflows."
      proofBullets={[
        'Generate new viewpoints from one image',
        'Explore rotate, tilt, and zoom style changes',
        'Create better first frames for image-to-video',
      ]}
      primaryCta={{ href: '/app/tools/angle', label: 'Open Tool' }}
      secondaryCta={{ href: '/examples', label: 'View Angle Examples' }}
      heroVisual={<AngleHeroVisual />}
      problemTitle="One Good Image Often Starts From the Wrong Angle"
      problemBody={
        <>
          <p>
            Sometimes the subject is right, but the viewpoint is wrong. Rebuilding the entire image from scratch wastes time and
            weakens consistency.
          </p>
          <p>
            That problem shows up in ads, product shots, storyboards, and first-frame planning. The content is close, but the
            framing, perspective, or camera height is not ready for the next step.
          </p>
        </>
      }
      solutionTitle="Generate New Perspectives Without Rebuilding Everything"
      solutionBody={
        <>
          <p>
            Angle / Perspective helps you change camera viewpoint from a source image so you can test framing, composition, and
            perspective before moving into image-to-video.
          </p>
          <p>
            Instead of regenerating the whole scene, you keep the image you already like and push it toward a better camera angle or
            motion-ready first frame.
          </p>
        </>
      }
      howItWorksTitle="How It Works"
      steps={[
        {
          title: 'Upload an image',
          body: 'Start with the frame, product shot, scene still, or reference image that already has the subject you want.',
        },
        {
          title: 'Adjust angle or perspective controls',
          body: 'Explore rotation, tilt, zoom, and multi-angle variations to find a stronger composition without rebuilding the image.',
        },
        {
          title: 'Generate a new first frame or alternate viewpoint',
          body: 'Choose the angle that works best, then carry it into image edits, storyboards, or video generation inside MaxVideoAI.',
        },
      ]}
      outputTitle="Explore More Than One View"
      outputCards={[
        {
          eyebrow: 'Composition test',
          title: 'Eye-level to low-angle',
          body: 'Shift from a flat eye-level frame toward a stronger low-angle view when you want more scale or authority.',
          visual: (
            <div className="grid grid-cols-2 gap-2">
              <AngleShot src={ANGLE_SOURCE_URL} alt="" label="Eye level" />
              <AngleShot src={ANGLE_OUTPUT_URL} alt="" label="Low angle" />
            </div>
          ),
        },
        {
          eyebrow: 'Portrait staging',
          title: 'Portrait to 3/4 view',
          body: 'Create a more usable portrait or story frame from one reference instead of prompting the whole scene again.',
          visual: (
            <div className="grid grid-cols-2 gap-2">
              <AngleShot src={ANGLE_SOURCE_URL} alt="" label="Source" />
              <AngleShot src={ANGLE_ALT_THREE_URL} alt="" label="3/4 view" />
            </div>
          ),
        },
        {
          eyebrow: 'Storyboarding',
          title: 'Hero shot to top-down',
          body: 'Generate alternate framing for boards, shot planning, or ad variations when you need another perspective fast.',
          visual: (
            <div className="grid grid-cols-2 gap-2">
              <AngleShot src={ANGLE_OUTPUT_URL} alt="" label="Hero shot" />
              <AngleShot src={ANGLE_ALT_FOUR_URL} alt="" label="Overhead feel" />
            </div>
          ),
        },
        {
          eyebrow: 'Ecommerce',
          title: 'Product front to side angle',
          body: 'Use perspective changes to turn one usable product image into more commercial-ready product angles.',
          visual: <ProductAngleMock />,
        },
      ]}
      benefitsTitle="Why It Matters"
      benefitCards={[
        {
          title: 'Explore compositions faster',
          body: 'You can test viewpoint and framing without paying the full cost of rebuilding a scene from scratch.',
        },
        {
          title: 'Avoid unnecessary re-generation',
          body: 'When the subject already works, perspective control helps you salvage the useful frame instead of discarding it.',
        },
        {
          title: 'Improve first-frame quality',
          body: 'A stronger first frame gives downstream image-to-video tools a clearer starting point and less ambiguity.',
        },
        {
          title: 'Test angles for ads, products, and story scenes',
          body: 'The same workflow supports product creative, social campaigns, scene setup, and shot planning for storytellers.',
        },
      ]}
      workflowTitle="Prepare a Better First Frame for Image-to-Video"
      workflowBody={
        <>
          <p>
            A stronger first frame gives your video workflow a clearer visual starting point. Use a cleaned-up angle or perspective
            before launching motion generation.
          </p>
          <p>
            You can refine the image in <Link href="/app/image" className="font-semibold text-link hover:text-link-hover">Image</Link>,
            launch motion in <Link href="/app" className="font-semibold text-link hover:text-link-hover">Video</Link>, and compare which
            engines handle that first frame best inside the MaxVideoAI model hub.
          </p>
        </>
      }
      workflowLinks={[
        { href: '/app/image', label: 'Open Image Workspace' },
        { href: '/app', label: 'Open Video Workspace' },
        { href: '/models/veo-3-1', label: 'Veo 3.1' },
        { href: '/models/kling-3-pro', label: 'Kling 3 Pro' },
        { href: '/models', label: 'Browse Model Hub' },
        { href: '/examples', label: 'See Examples' },
      ]}
      useCasesTitle="Best Use Cases"
      useCaseCards={[
        { title: 'Storyboarding and previsualization', body: 'Test perspective before you commit to a sequence, a board, or an animatic.' },
        { title: 'Product and ecommerce shots', body: 'Turn one clean product image into multiple usable angles for listings, ads, or launch pages.' },
        { title: 'Social content', body: 'Quickly build alternate viewpoints for vertical edits, thumbnails, and platform-specific variants.' },
        { title: 'Ad creative testing', body: 'Swap camera perspective without rebuilding the whole concept when you need more versions fast.' },
        { title: 'Character scene setup', body: 'Find a stronger first frame for a scene before you move that subject into image-to-video.' },
      ]}
      faqTitle="Camera Angle AI FAQ"
      faqs={[
        {
          question: 'Can AI change the camera angle of a photo?',
          answer:
            'Yes. AI can generate alternate viewpoints from a source image so you can explore new framing or perspective without rebuilding the whole image from zero.',
        },
        {
          question: 'What is the difference between camera angle and image perspective?',
          answer:
            'Camera angle usually refers to where the camera is placed relative to the subject, while image perspective is the broader sense of spatial viewpoint, depth, and geometry. In practice, both matter when you want a better first frame.',
        },
        {
          question: 'Can I use this for product photos?',
          answer:
            'Yes. Product and ecommerce teams can use angle changes to turn one source image into alternate packshot-style views, side angles, or more dramatic hero frames.',
        },
        {
          question: 'Does this help before image-to-video generation?',
          answer:
            'Yes. A better angle gives your motion workflow a cleaner starting frame, which helps the next stage understand composition, subject placement, and visual priority.',
        },
        {
          question: 'Can I generate multiple angles from one image?',
          answer:
            'Yes. The workflow is built to explore more than one usable viewpoint from a single source image so you can compare options before you move forward.',
        },
      ]}
      finalTitle="Generate a Better Camera Angle"
      finalBody={
        <p>
          Change the viewpoint without redoing the whole image. Turn one image into multiple usable camera angles, choose the strongest
          first frame, and connect it back to the rest of your MaxVideoAI workflow.
        </p>
      }
      finalCta={{ href: '/app/tools/angle', label: 'Open Angle Tool' }}
      schemaDescription="Upload one image, change camera angle, and generate new perspectives with AI to build better first frames for image-to-video, storyboards, ads, and product shots."
      schemaFeatures={[
        'Change the viewpoint without redoing the whole image',
        'Turn one image into multiple usable camera angles',
        'Create stronger first frames before image-to-video',
      ]}
    />
  );
}
