import type { JSX } from 'react';
import { Clapperboard } from 'lucide-react';

export type AppGlyphName = 'create' | 'studio' | 'image' | 'video' | 'audio' | 'library' | 'tools' | 'settings' | 'wallet' | 'reference' | 'prompt' | 'connect' | 'menu' | 'external' | 'start' | 'end';
const PATHS: Record<Exclude<AppGlyphName, 'studio'>, string> = {
  start: 'M3 3h18v18H3V3zm2 2v14h14V5H5zm2 3h2v8H7zm4 0 6 4-6 4V8z',
  end: 'M3 3h18v18H3V3zm2 2v14h14V5H5zm10 3h2v8h-2zM7 8l6 4-6 4V8z',
  create: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM16 13h3v3h3v3h-3v3h-3v-3h-3v-3h3z',
  image: 'M3 3h18v18H3V3zm2 2v14h14V5H5zm2 11 4-5 3 3 2-2 2 5H7zm2-9a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  video: 'M3 4h18v16H3V4zm2 2v12h14V6H5zm4 1 7 5-7 5V7z',
  audio: 'M3 9h3v6H3zM8 4h3v16H8zM13 7h3v10h-3zM18 2h3v20h-3z',
  library: 'M2 4h6v6H2zM10 4h12v2H10zM10 8h9v2h-9zM2 14h6v6H2zM10 14h12v2H10zM10 18h9v2h-9z',
  tools: 'M3 3h8v8H3zM15 3h3v3h3v3h-3v3h-3V9h-3V6h3zM3 15h8v3H3zM14 14h7v7h-7z',
  settings: 'M3 5h5V3h3v7H8V8H3zM14 5h7v3h-7zM3 16h10v-3h3v8h-3v-2H3zM19 16h2v3h-2z',
  wallet: 'M3 4h17v4h2v13H2V6l1-2zm2 2v2h13V6H5zm-1 4v9h16v-9H4zm11 3h3v3h-3z',
  reference: 'M2 2h15v3H5v12H2zM7 7h15v15H7V7zm2 2v11h11V9H9zm1 8 3-4 2 2 2-2 2 5h-9z',
  prompt: 'M3 4h18v3H3zM3 10h14v3H3zM3 16h10v3H3z',
  connect: 'M4 3h7v7H8V6H6v6h6v-2h3v5H3V3h1zm9 6h8v12H9v-8h3v5h6v-6h-5V9z',
  menu: 'M3 5h18v3H3zM3 11h18v3H3zM3 17h18v3H3z',
  external: 'M12 3h9v9h-3V8l-8 8-2-2 8-8h-4V3zM3 7h6v3H6v8h8v-3h3v6H3V7z',
};
export function AppGlyph({ name, className }: { name: AppGlyphName; className?: string }): JSX.Element {
  if (name === 'studio') {
    return <Clapperboard className={className ?? 'app-glyph'} aria-hidden="true" focusable="false" strokeWidth={1.9} />;
  }
  return <svg viewBox="0 0 24 24" className={className ?? 'app-glyph'} fill="currentColor" fillRule="evenodd" aria-hidden="true" focusable="false"><path d={PATHS[name]} /></svg>;
}
