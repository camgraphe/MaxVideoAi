export type StarterMediaSurface = 'image' | 'audio';
export type StarterMedia = {
  id: string;
  title: string;
  src: string;
  prompt: string;
  audioKind?: 'voice' | 'music' | 'song';
};
export const STARTER_MEDIA_SLUGS = { image: 'starter-image', audio: 'starter-audio' } as const;

/** Authored public samples, never inserted into an account's history or saved Media. */
export const BUILTIN_STARTER_MEDIA: Record<StarterMediaSurface, StarterMedia[]> = {
  image: [
    { id: 'night-shift', title: 'Night shift', src: '/assets/app-starters/night-shift-9f91929fe7da.webp', prompt: 'A realistic raccoon waiting in a worn laundromat at 3am, holding one red sock. Pink soap bubbles overflow from a washing machine. Cracked mint tiles, harsh green fluorescent light, red neon reflections, gritty 35mm grain, deadpan absurdist cinema, square composition.' },
    { id: 'acid-portrait', title: 'Acid portrait', src: '/assets/app-starters/acid-portrait-f5440c7f5eb0.webp', prompt: 'Close editorial portrait of an adult punk woman with jagged cherry-red hair and cobalt eye makeup blowing an enormous lime-green bubblegum bubble. Battered black leather, orange diner tiles, direct camera flash, skin texture, underground music zine attitude, 35mm grain, square composition.' },
    { id: 'disco-motel', title: 'Disco motel', src: '/assets/app-starters/disco-motel-0b809fbcec19.webp', prompt: 'A weather-beaten turquoise motel among enormous pink desert dunes. An empty swimming pool filled with yellow tennis balls, a giant silver disco ball half-buried behind the motel. Ultramarine sky, brutal midday shadows, bleached paint, surreal deadpan Americana, medium-format film grain, square composition.' },
  ],
  audio: [
    { id: 'every-story', title: 'Every story', audioKind: 'voice', src: '/assets/app-starters/every-story-0732966f796d.mp3', prompt: 'Every story starts with a small idea. A place you have never been. A character you cannot forget. Give it a voice, and suddenly, the whole world comes alive.' },
    { id: 'electro-funk', title: 'Electro-funk', audioKind: 'music', src: '/assets/app-starters/electro-funk-c1a8c5151e60.mp3', prompt: 'Original instrumental, 128 BPM, punchy syncopated electro-funk and clean breakbeat groove. Tight kick, crisp snare, warm bouncing synth bass, short bright pluck accents. No voices or vocal samples.' },
    { id: 'outside-the-lines', title: 'Outside the Lines', audioKind: 'song', src: '/assets/app-starters/outside-the-lines-30a8afe0351b.mp3', prompt: 'Original English indie electro-pop song, 112 BPM. Playful female lead, bouncy analog synth bass, crisp drums, shimmering offbeat guitar. Start with a melodic chorus.' },
  ],
};

export function isPublicStarterMediaUrl(src: unknown): src is string {
  if (typeof src !== 'string') return false;
  if (/^\/assets\/(app-starters|audio\/seed-audio)\/[a-z0-9_-]+\.(webp|mp3)$/.test(src)) return true;
  try {
    const url = new URL(src);
    return url.protocol === 'https:' && url.hostname === 'media.maxvideoai.com'
      && !url.username && !url.password && !url.search && !url.hash;
  } catch { return false; }
}
