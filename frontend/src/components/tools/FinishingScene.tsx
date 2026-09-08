import type { FinishingToolId } from '@/lib/toolbox/finishing';

/** Symbolic scenes, not fabricated processed examples. */
export function FinishingScene({ kind }: { kind: FinishingToolId }) {
  const colors = { 'restore-video': ['#45412f', '#d5ad70'], denoise: ['#233d3c', '#c6d9c0'], 'fix-blur': ['#4a3440', '#e7ad96'], 'smooth-motion': ['#283849', '#bdced9'] }[kind];
  return <svg viewBox="0 0 600 340" aria-hidden="true" focusable="false" style={{ display: 'block', width: '100%', height: '100%' }}>
    <rect width="600" height="340" fill={colors[0]} />
    <circle cx="450" cy="65" r="140" fill={colors[1]} opacity=".06" />
    {kind === 'restore-video' ? <>
      <g transform="rotate(-8 260 175)"><rect x="97" y="56" width="334" height="235" rx="12" fill="#a29779" /><rect x="110" y="72" width="308" height="198" rx="4" fill="#625c48" /><path d="m112 232 88-98 49 55 70-84 97 127" fill="#bdb093" /><circle cx="353" cy="115" r="23" fill="#e4c692" /><path d="m166 70 14 54-14 52 18 94m144-198-12 76 16 77-11 35" fill="none" stroke="#433e31" strokeWidth="4" /></g>
      <path d="m414 81 19 49 49 19-49 19-19 49-19-49-49-19 49-19z" fill="#f3d193" /><path d="m473 216 8 22 22 8-22 8-8 22-8-22-22-8 22-8z" fill="#d5ad70" />
    </> : kind === 'denoise' ? <>
      <rect x="82" y="62" width="436" height="216" rx="10" fill="#537369" />
      <path d="M85 239 218 95l94 104 71-79 133 133v25H85z" fill="#c6d9c0" /><path d="m218 95 21 84-23-12-32 13" fill="#f0edd4" />
      {Array.from({ length: 76 }, (_, n) => <circle key={n} cx={92 + (n * 47) % 210} cy={70 + (n * 31) % 196} r={n % 3 + 1} fill={n % 2 ? '#e9e7cf' : '#102f2d'} opacity=".7" />)}
      <path d="M314 43v250" stroke="#e8d094" strokeWidth="4" /><rect x="301" y="144" width="26" height="51" rx="13" fill="#e8d094" />
    </> : kind === 'fix-blur' ? <>
      {[0, 1, 2].map(n => <g key={n} opacity={[.12, .28, 1][n]} transform={`translate(${n * 35} 0)`}><path d="m164 226 79-121 42 71 99-29-43 94-82-40z" fill={colors[1]} /><path d="m243 105 5 96-84 25" fill="#f1d0b4" /></g>)}
      <path d="M134 131v-36h38m294 36v-36h-38M134 215v36h38m294-36v36h-38" fill="none" stroke="#efce9b" strokeWidth="4" />
    </> : <>
      <path d="M63 242q159-209 461-81" fill="none" stroke="#a9bfc9" strokeWidth="2" strokeDasharray="5 8" />
      {[0, 1, 2, 3, 4].map(n => <g key={n} transform={`translate(${100 + n * 93} ${211 - Math.sin(n * .65) * 95})`} opacity={.25 + n * .18}><circle r="31" fill="#e3c598" /><path d="m-9-15 25 15-25 15z" fill="#344a5a" /></g>)}
      <path d="M94 293h401m-14-9 14 9-14 9" fill="none" stroke="#d8bd8d" strokeWidth="3" />
    </>}
  </svg>;
}
