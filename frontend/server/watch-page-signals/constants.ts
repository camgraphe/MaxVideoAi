export const MODE_LABELS: Record<string, string> = {
  t2v: 'Text to video',
  i2v: 'Image to video',
  r2v: 'Reference to video',
  a2v: 'Audio to video',
  extend: 'Video extend',
  retake: 'Video retake',
};

export const STYLE_PATTERNS: Array<{ tag: string; label: string; patterns: RegExp[] }> = [
  { tag: 'cinematic', label: 'cinematic', patterns: [/\bcinematic\b/i, /\bfilm(ic)?\b/i, /\bdramatic\b/i] },
  { tag: 'realistic', label: 'realistic', patterns: [/\brealistic\b/i, /\bphotoreal/i, /\bdocumentary\b/i] },
  { tag: 'anime', label: 'anime', patterns: [/\banime\b/i, /\bmanga\b/i] },
  { tag: 'portrait', label: 'portrait', patterns: [/\bportrait\b/i, /\bhead\s?shot\b/i, /\bclose[- ]up\b/i] },
  { tag: 'commercial', label: 'commercial', patterns: [/\bcommercial\b/i, /\bproduct ad\b/i, /\bad spot\b/i] },
];

export const DESCRIPTOR_PATTERNS: Array<{ label: string; patterns: RegExp[] }> = [
  { label: 'luxury perfume commercial', patterns: [/\bperfume\b/i, /\bluxury\b/i] },
  { label: 'smartwatch runner ad', patterns: [/\bsmartwatch\b/i, /\brunner\b/i] },
  { label: 'office transition', patterns: [/\boffice\b/i, /\btransition\b/i] },
  { label: 'city-to-studio flythrough', patterns: [/\bcity\b/i, /\bstudio\b/i, /\bflythrough\b/i] },
  { label: 'living room commercial', patterns: [/\bliving room\b/i, /\bcommercial\b/i] },
  { label: 'studio interview push-in', patterns: [/\binterview\b/i, /\bpush[- ]?in\b/i] },
  { label: 'futuristic city flythrough', patterns: [/\bfuturistic city\b/i, /\bdrone\b/i] },
  { label: 'cinematic walk toward camera', patterns: [/\bwalk toward camera\b/i] },
  { label: 'night city flythrough', patterns: [/\bnight\b/i, /\bcity\b/i, /\bflythrough\b/i] },
  { label: 'moody portrait turn', patterns: [/\bportrait\b/i, /\bturn\b/i] },
  { label: 'hallway escape', patterns: [/\bhallway\b/i, /\bescape\b/i] },
  { label: 'window transition', patterns: [/\bwindow\b/i, /\btransition\b/i] },
];

export const CAMERA_PATTERNS: Array<{ tag: string; label: string; patterns: RegExp[] }> = [
  { tag: 'camera-move', label: 'camera move', patterns: [/\bcamera move/i, /\bcamera motion/i] },
  { tag: 'push-in', label: 'push-in', patterns: [/\bpush[- ]?in\b/i] },
  { tag: 'tracking', label: 'tracking', patterns: [/\btracking\b/i] },
  { tag: 'drone', label: 'drone', patterns: [/\bdrone\b/i, /\baerial\b/i, /\bfpv\b/i, /\bflythrough\b/i] },
  { tag: 'close-up', label: 'close-up', patterns: [/\bclose[- ]?up\b/i] },
  { tag: 'transition', label: 'transition', patterns: [/\btransition\b/i] },
];

export const CLUSTER_LABEL_OVERRIDES: Record<string, string> = {
  sora: 'Sora',
  veo: 'Veo',
  kling: 'Kling',
  wan: 'Wan',
  seedance: 'Seedance',
  ltx: 'LTX',
  pika: 'Pika',
  hailuo: 'Hailuo',
};
