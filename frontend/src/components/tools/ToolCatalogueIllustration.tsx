/** Decorative diagrams describe the tool, without pretending to be generated output. */
export function ToolCatalogueIllustration({ kind }: { kind: 'storyboard' | 'upscale' }) {
  return (
    <svg viewBox="0 0 480 270" fill="none" aria-hidden="true" focusable="false" className="h-full w-full">
      {kind === 'storyboard' ? (
        <>
          <path d="M44 204h392" stroke="currentColor" strokeOpacity=".2" strokeWidth="2" />
          {[0, 1, 2].map((frame) => (
            <g key={frame} transform={`translate(${44 + frame * 136} 64)`}>
              <path d="M0 0h120v104H0z" fill="currentColor" fillOpacity=".08" />
              <path d="M0 104V76l30-30 32 30 22-20 36 36v12H0Z" fill="currentColor" fillOpacity=".22" />
              <circle cx={74 - frame * 12} cy={35} r={12 + frame * 3} fill="currentColor" fillOpacity=".7" />
              <path d={`M${54 - frame * 14} 94v-20a${20 + frame * 2} ${20 + frame * 2} 0 0 1 ${40 + frame * 4} 0v20Z`} fill="currentColor" />
              <path d="M0 122h22m7 0h8" stroke="currentColor" strokeWidth="3" />
            </g>
          ))}
          <path d="m184 200 5 4-5 4m136-8 5 4-5 4" stroke="currentColor" strokeWidth="2" />
        </>
      ) : (
        <>
          <path d="M46 91h90v90H46z" fill="currentColor" fillOpacity=".08" />
          <path d="M46 159h22v-23h23v-22h22v22h23v45H46z" fill="currentColor" fillOpacity=".5" />
          <path d="M252 54h164v164H252z" fill="currentColor" fillOpacity=".08" />
          <path d="m252 190 49-71 40 43 30-31 45 63v24H252z" fill="currentColor" />
          <circle cx="372" cy="95" r="17" fill="currentColor" fillOpacity=".45" />
          <path d="M164 136h55m-12-12 12 12-12 12M252 76V54h22m120 0h22v22m0 120v22h-22m-120 0h-22v-22" stroke="currentColor" strokeWidth="3" />
        </>
      )}
    </svg>
  );
}
