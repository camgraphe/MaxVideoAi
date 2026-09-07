// Local review fixtures. Limits belong to UI scenarios, not production models.
export const profiles = {
  images: { name: 'Création & références', kind: 'image', detail: 'Créer ou transformer une image', max: 8, roles: [
    { id: 'image', kind: 'image', name: 'Référence image', max: 8 },
  ] },
  music: { name: 'Musique', kind: 'audio', detail: 'Composer une piste autonome', max: 0, roles: [] },
  voice: { name: 'Voix', kind: 'audio', detail: 'Script et échantillon vocal', max: 1, roles: [
    { id: 'voice', kind: 'audio', name: 'Échantillon vocal', max: 1 },
  ] },
  sound: { name: 'Sonoriser', kind: 'audio', outputKind: 'video', detail: 'Bande-son depuis une vidéo', max: 1, roles: [
    { id: 'source', kind: 'video', name: 'Vidéo source', max: 1, required: true },
  ] },
};
export const media = [
  { id: 'i1', kind: 'image', name: 'Cité connectée', url: 'assets/hero.webp', source: 'Exemple du dépôt' },
  { id: 'i2', kind: 'image', name: 'La cartographe', focus: '50% 10%', url: 'assets/cartographer.png', source: 'Exemple du dépôt' },
  { id: 'i3', kind: 'image', name: 'Campagne matière', url: 'assets/campaign.webp', source: 'Exemple du dépôt' },
  { id: 'i4', kind: 'image', name: 'Étude de produit', url: 'assets/product.webp', source: 'Exemple du dépôt' },
  { id: 'v1', kind: 'video', name: 'Plan de démonstration', url: 'assets/demo.mp4', poster: 'assets/video-poster.jpg', source: 'Exemple du dépôt' },
  { id: 'a1', kind: 'audio', name: 'Ambiance de station', url: 'assets/ambience.wav', source: 'Exemple du dépôt' },
];
export const labels = { video: 'Vidéo', image: 'Image', audio: 'Audio' };
export const defaults = { video: 'automatic', image: 'images', audio: 'music' };

// Original geometric pictograms: common 24-unit grid, solid mass + tinted detail.
const shapes = {
  first: '<path d="M2 3h3v18H2z"/><path d="M8 4h14v16H8z" opacity=".25"/><circle cx="18" cy="8" r="1.5"/><path d="m8 18 5-7 4 5 2-2 3 4v2H8z"/>',
  last: '<path d="M19 3h3v18h-3z"/><path d="M2 4h14v16H2z" opacity=".25"/><circle cx="12" cy="8" r="1.5"/><path d="m2 18 5-7 4 5 2-2 3 4v2H2z"/>',
  reference: '<path d="M2 2h15v3H5v12H2z" opacity=".4"/><path d="M7 7h15v15H7z" opacity=".25"/><circle cx="17.5" cy="11.5" r="1.5"/><path d="m8 20 5-7 4 5 2-2 3 4v2H8z"/>',
  prompt: '<path d="M3 4h18v15H3z" opacity=".2"/><path d="M6 7h10v2H6zm0 4h7v2H6zm0 4h6v2H6zm10-4h2v7h-2z"/>',
  create: '<path d="M4 3h10l6 6v12H4z" opacity=".25"/><path d="M13 3v7h7M7 14h10v2H7zm0 4h6v2H7z"/><path d="m8 5 1 3 3 1-3 1-1 3-1-3-3-1 3-1z"/>',
  image: '<path d="M3 4h18v16H3z" opacity=".25"/><circle cx="16" cy="9" r="2"/><path d="m3 18 6-8 5 6 3-3 4 5v2H3z"/>',
  video: '<path d="M3 5h18v14H3z" opacity=".25"/><path d="m10 8 7 4-7 4zM2 3h6v2H2zm8 0h5v2h-5zm7 0h5v2h-5zM2 19h6v2H2zm8 0h5v2h-5zm7 0h5v2h-5z"/>',
  audio: '<path d="M2 8h20v8H2z" opacity=".2"/><path d="M3 9h2v6H3zm4-5h2v16H7zm4 3h2v10h-2zm4-5h2v20h-2zm4 6h2v8h-2z"/>',
  library: '<path d="M2 7h20v14H2z" opacity=".25"/><path d="M3 3h7l3 3h8v3H3zm2 9h5v6H5zm7 0h7v2h-7zm0 4h7v2h-7z"/>',
  tools: '<path d="m3 17 12-12 4 4L7 21H3z" opacity=".3"/><path d="m17 2 5 5-3 3-5-5zM2 3h7v3H5v4H2zm12 14h5v-5h3v8h-8z"/>',
  studio: '<path d="M2 3h20v11H2z" opacity=".25"/><path d="m10 5 6 4-6 3zM2 17h6v4H2zm8 0h12v4H10zM7 15h2v8H7z"/>',
  settings: '<path d="M4 2h16v20H4z" opacity=".2"/><path d="M7 5h2v14H7zm8 0h2v14h-2z"/><path d="M5 8h6v4H5zm8 5h6v4h-6z"/>',
  plus: '<path d="M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z"/>',
  close: '<path d="m6 4 6 6 6-6 2 2-6 6 6 6-2 2-6-6-6 6-2-2 6-6-6-6z"/>',
  arrow: '<path d="M3 11h13l-5-5 2-2 9 8-9 8-2-2 5-5H3z"/>',
  back: '<path d="M21 11H8l5-5-2-2-9 8 9 8 2-2-5-5h13z"/>',
  down: '<path d="m5 8 7 7 7-7 2 2-9 9-9-9z"/>',
  up: '<path d="m5 16 7-7 7 7 2-2-9-9-9 9z"/>',
  check: '<path d="m3 12 5 5L20 5l2 2L8 21l-7-7z"/>',
  search: '<path d="M10 2a8 8 0 1 0 5 14l6 6 2-2-6-6A8 8 0 0 0 10 2m0 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10"/>',
  upload: '<path d="M3 15h3v4h12v-4h3v7H3z" opacity=".35"/><path d="m4 9 8-8 8 8-2 2-5-5v10h-2V6l-5 5z"/>',
  replace: '<path d="M3 5h12V2l7 5-7 5V9H3zM21 19H9v3l-7-5 7-5v3h12z"/>',
  remove: '<path d="M5 7h14l-1 15H6z" opacity=".3"/><path d="M9 2h6v2h6v2H3V4h6zm0 7h2v10H9zm4 0h2v10h-2z"/>',
  connect: '<path d="M3 5h6v14H3zM15 5h6v14h-6z" opacity=".3"/><path d="M6 9h12v6H6zm3-5h2v3H9zm4 0h2v3h-2zm-4 13h2v3H9zm4 0h2v3h-2z"/>',
  wallet: '<path d="M3 5h18v16H3z" opacity=".25"/><path d="M3 3h15v3H5v2H3zm11 7h8v7h-8z"/><circle cx="17" cy="13.5" r="1" fill="var(--bg)"/>',
  external: '<path d="M3 6h7v3H6v10h10v-4h3v7H3z" opacity=".4"/><path d="M13 2h9v9h-3V7l-8 8-2-2 8-8h-4z"/>',
  play: '<path d="m7 3 15 9-15 9z"/>',
};
export const icon = (name) => `<svg viewBox="0 0 24 24" class="icon" aria-hidden="true" focusable="false">${shapes[name] || shapes.create}</svg>`;

// Explicit volume fixture for browser QA only; never a model capacity.
if (new URLSearchParams(location.search).get('volume') === '50') {
  const base = [...media];
  for (let i = media.length; i < 50; i++) {
    const example = base[i % base.length];
    media.push({...example, id: `volume-${i}`, name: `${example.name} · test ${i + 1}`, source: 'Collection de test · média répété'});
  }
}
