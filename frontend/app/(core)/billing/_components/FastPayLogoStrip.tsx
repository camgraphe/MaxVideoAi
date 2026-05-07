export function FastPayLogoStrip() {
  return (
    <span className="inline-flex items-center justify-center gap-1.5" aria-hidden="true">
      <span className="inline-flex h-6 min-w-[54px] items-center justify-center rounded-[5px] bg-black px-2 text-[11px] font-semibold leading-none text-white shadow-sm">
        Apple Pay
      </span>
      <span className="inline-flex h-6 min-w-[50px] items-center justify-center gap-0.5 rounded-[5px] border border-border bg-white px-2 text-[11px] font-semibold leading-none text-slate-800 shadow-sm">
        <span className="text-[#4285f4]">G</span>
        <span>Pay</span>
      </span>
      <span className="inline-flex h-6 min-w-[56px] items-center justify-center rounded-[5px] border border-[#d7e8ff] bg-white px-2 text-[11px] font-bold leading-none shadow-sm">
        <span className="text-[#003087]">Pay</span>
        <span className="text-[#009cde]">Pal</span>
      </span>
      <span className="inline-flex h-6 min-w-[42px] items-center justify-center rounded-[5px] bg-[#625afa] px-2 text-[11px] font-bold leading-none text-white shadow-sm">
        Link
      </span>
    </span>
  );
}
