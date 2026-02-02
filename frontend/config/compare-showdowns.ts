export type CompareShowdown = {
  id: string;
  title: string;
  whatItTests: string;
  aspectRatio: string;
  mode: 't2v' | 'i2v' | 'v2v';
  prompt: string;
};

export const COMPARE_SHOWDOWNS: CompareShowdown[] = [
  {
    id: 'motion-physics',
    title: 'Fast Motion + Physics (16:9)',
    whatItTests: 'Motion Realism + Temporal Consistency + Visual Quality',
    aspectRatio: '16:9',
    mode: 't2v',
    prompt:
      'Wide 16:9 cinematic action shot, a runner sprints through a rainy city street at night, water splashes realistically with each step, reflections on wet asphalt, handheld tracking camera following from the side. Dynamic motion with believable inertia and physics, no rubbery limbs, no wobbling background, stable scene geometry, minimal temporal flicker, sharp details despite fast movement, realistic motion blur.',
  },
  {
    id: 'ugc-lipsync',
    title: 'UGC Talking Head + Lip Sync (9:16)',
    whatItTests: 'Human Fidelity + Audio/Lip Sync + Prompt Adherence',
    aspectRatio: '9:16',
    mode: 't2v',
    prompt:
      'Vertical 9:16 TikTok-style UGC selfie video, handheld smartphone feel, natural indoor daylight near a window. A friendly creator speaks directly to camera with natural blinking, subtle head nods, and a warm smile. Add small human imperfections: a tiny hesitation, a soft breath, a quick smile mid-sentence, and a micro-pause before the last line. Realistic skin texture, stable identity, no face warping, minimal flicker, clean audio with natural room tone.\n\nNo subtitles. No on-screen text. No logos. No watermarks.\n\nThe creator says (exactly, with the same pacing and hesitations):\n“Okay, so… um… quick thing. If you’re feeling stuck, just do the tiniest first step… like, set a two-minute timer and start. (smiles) That’s it. You’ll be surprised how fast it gets easier.”',
  },
  {
    id: 'hands-text',
    title: 'Hands + Product Demo + On-screen Text',
    whatItTests: 'Hands/Fingers + Text & UI Legibility + Prompt Adherence',
    aspectRatio: '16:9',
    mode: 't2v',
    prompt:
      'Wide 16:9 full-body unboxing video in a clean studio/kitchen setting. A person is fully visible (head-to-toe or at least head-to-knees) standing behind a minimalist tabletop. They unbox a small generic gadget from a plain matte cardboard box: peel the seal, open the lid, remove the inner tray, take out the device and accessories, and lay everything neatly on the table. The person occasionally lifts the item toward the camera for a closer look, then places it back down.\n\nRealism requirements: natural body proportions, stable identity, realistic skin and clothing fabric, no face warping, no unnatural limb bending. Hands must be highly realistic: correct finger count, natural grip, believable pressure/contact with the box and device, consistent shadows, no extra fingers, no “floating” objects. Keep object geometry stable, no wobbling background, minimal temporal flicker.\n\nCamera: single continuous shot, tripod-stable, slight cinematic push-in (very slow), eye-level or slightly above table height. Natural soft daylight, clean shadows, realistic materials and textures. No logos, no brand names, no watermarks. No subtitles.\n\nOptional on-screen title at the top (perfectly readable and stable, no jitter):\n\"UNBOXING — FIRST LOOK\"',
  },
];
