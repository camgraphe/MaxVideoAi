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
    id: 'ugc-lipsync',
    title: 'UGC Talking Head + Lip Sync (9:16)',
    whatItTests: 'Human Fidelity + Audio/Lip Sync + Prompt Adherence + Caption readability',
    aspectRatio: '9:16',
    mode: 't2v',
    prompt:
      "Vertical 9:16 UGC selfie video, handheld smartphone feel, natural indoor lighting in a kitchen. A friendly creator looks into the camera and speaks clearly with natural blinking and subtle head movements. Add burned-in captions at the bottom (clean, readable). The creator says: ‘I tested two AI video engines side by side — same prompt, different results.’ Realistic skin texture, natural mouth shapes, no uncanny face warping, stable identity, minimal flicker.",
  },
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
    id: 'hands-text',
    title: 'Hands + Product Demo + On-screen Text',
    whatItTests: 'Hands/Fingers + Text & UI Legibility + Prompt Adherence',
    aspectRatio: '16:9',
    mode: 't2v',
    prompt:
      "Product demo video on a clean tabletop, two human hands unbox a matte black coffee grinder, rotate it, and place it next to a glass cup. Close-up shots with realistic fingers, no extra fingers, natural grip and contact. Add a simple on-screen title at the top: ‘Coffee Grinder Demo’ (must be perfectly readable and stable). Soft daylight, clean shadows, minimal flicker, consistent object shape and texture.",
  },
];
