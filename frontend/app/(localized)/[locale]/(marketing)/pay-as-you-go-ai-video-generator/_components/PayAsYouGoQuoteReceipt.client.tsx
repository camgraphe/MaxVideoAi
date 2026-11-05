'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { PayAsYouGoModelRow } from '../_lib/payg-page-data';

type Option = Pick<PayAsYouGoModelRow, 'id' | 'engineName' | 'priceCells'>;
type Props = { options: Option[]; label: string; modelLabel: string; settingsLabel: string; amountLabel: string; wallet: string; prices: string };

export function PayAsYouGoQuoteReceipt({ options, label, modelLabel, settingsLabel, amountLabel, wallet, prices }: Props) {
  const first = options.find(row => row.priceCells.some(cell => cell.renderReady)) ?? options[0];
  const [model, setModel] = useState(first?.id);
  const [preset, setPreset] = useState(first?.priceCells.find(cell => cell.renderReady)?.presetId);
  const row = options.find(item => item.id === model) ?? first;
  const cell = row?.priceCells.find(item => item.presetId === preset) ?? row?.priceCells[0];
  if (!row || !cell) return null;
  const selectClass = 'block min-h-11 w-full appearance-none rounded-sm border-b border-[#b9ac99] bg-transparent py-1.5 pr-6 text-[#302a22] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#835021]';
  return (
    <aside data-payg-receipt className="rounded-lg bg-[#e7e1d4] px-5 py-7 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-[360px] bg-[#fffdf6] p-5 text-[#302a22] shadow-[0_8px_22px_#4732171c] sm:p-7">
        <div className="flex items-center justify-between gap-2 border-b border-dashed border-[#b6ad9d] pb-4">
          <span className="font-semibold tracking-tight">MaxVideoAI</span>
          <span aria-hidden className="h-4 w-12 bg-[repeating-linear-gradient(90deg,#564d40_0_1px,transparent_1px_3px,#564d40_3px_5px,transparent_5px_7px)]" />
        </div>
        <p className="my-4 font-mono text-xs uppercase leading-5 tracking-wider">{label}</p>
        <label className="block text-xs">
          {modelLabel}
          <span className="relative block">
            <select value={row.id} onChange={event => setModel(event.target.value)} className={`${selectClass} font-serif text-xl`}>
              {options.map(option => <option key={option.id} value={option.id}>{option.engineName}</option>)}
            </select>
            <ChevronDown aria-hidden className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2" />
          </span>
        </label>
        <label className="mt-4 block text-xs">
          {settingsLabel}
          <span className="relative block">
            <select value={cell.presetId} onChange={event => setPreset(row.priceCells.find(item => item.presetId === event.target.value)?.presetId)} className={`${selectClass} font-mono text-sm`}>
              {row.priceCells.map(item => <option key={item.presetId} value={item.presetId}>{item.label}</option>)}
            </select>
            <ChevronDown aria-hidden className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2" />
          </span>
        </label>
        <div aria-live="polite" aria-atomic="true" className="mt-5">
          <p className="text-xs">{amountLabel}</p>
          <p className="mt-1 font-mono text-2xl font-medium leading-tight tabular-nums">{cell.displayValue}</p>
          {cell.note ? <p className="mt-1 text-xs">{cell.note}</p> : null}
        </div>
        <p className="mt-4 border-t border-dashed border-[#b6ad9d] pt-3 text-xs leading-5">{wallet}</p>
        <a href="#compare-price-per-model" className="inline-flex min-h-11 items-center text-xs font-semibold text-[#714521] underline underline-offset-4">{prices}</a>
      </div>
    </aside>
  );
}
