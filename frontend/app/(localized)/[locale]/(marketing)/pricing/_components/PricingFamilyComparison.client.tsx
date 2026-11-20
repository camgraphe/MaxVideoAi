'use client';

import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import type { AppLocale } from '@/i18n/locales';
import { pricingOpeningCopy } from '../_lib/pricing-opening-copy';
import { PricingCopy } from './PricingCopy.client';
import styles from './pricing-families.module.css';

type Preset = { id: string; label: string };
type Choice = { id: string; name: string; price: string };

export function PricingFamilyComparison({ locale, presets, canonical, date, children }: {
  locale: AppLocale; presets: Preset[]; canonical: string; date: string; children: ReactNode;
}) {
  const copy = pricingOpeningCopy[locale];
  const scope = useRef<HTMLDivElement>(null);
  const [ids, setIds] = useState<string[]>([]);
  const [preset, setPreset] = useState('5s-720p');
  const [ready, setReady] = useState(false);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [pageUrl, setPageUrl] = useState(canonical);
  useEffect(() => {
    const root = scope.current!;
    function restore() {
      if (!window.location.hash.startsWith('#compare?')) return;
      const params = new URLSearchParams(window.location.hash.slice(9));
      const requested = params.get('scenario');
      setPreset(presets.some(p => p.id === requested) ? requested! : '5s-720p');
      const rows = [...root.querySelectorAll<HTMLTableRowElement>('tr[data-model]')];
      const valid = [...new Set(params.getAll('model'))].filter(id => rows.some(row => row.id === id)).slice(0, 3);
      setIds(valid);
      if (!valid.length) return;
      const outer = root.closest('details');
      if (outer) outer.open = true;
      root.scrollIntoView({ block: 'start' });
    }
    setPageUrl(window.location.origin + window.location.pathname);
    restore();
    setReady(true);
    window.addEventListener('hashchange', restore);
    return () => window.removeEventListener('hashchange', restore);
  }, [presets]);
  useEffect(() => {
    const rows = Array.from(scope.current!.querySelectorAll<HTMLTableRowElement>('tr[data-model]'));
    for (const row of rows) {
      const checkbox = row.querySelector<HTMLInputElement>('input[type=checkbox]')!;
      checkbox.checked = ids.includes(row.id);
      checkbox.disabled = ids.length >= 3 && !checkbox.checked;
    }
    setChoices(ids.flatMap(id => {
      const row = rows.find(item => item.id === id);
      const cell = row?.querySelector<HTMLElement>('[data-preset="' + preset + '"]');
      return row && cell ? [{ id, name: row.dataset.model!, price: cell.dataset.quote! }] : [];
    }));
  }, [ids, preset]);
  function select(event: ChangeEvent<HTMLDivElement>) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'checkbox') return;
    const id = input.closest('tr')?.id;
    if (id) setIds(previous => input.checked ? [...new Set([...previous, id])].slice(0, 3) : previous.filter(value => value !== id));
  }
  const scenario = presets.find(item => item.id === preset)?.label ?? '';
  const params = new URLSearchParams({ scenario: preset });
  ids.forEach(id => params.append('model', id));
  const quote = choices.map(row => `${row.name} · ${scenario} · ${row.price} · ${canonical}#compare?${new URLSearchParams({ scenario: preset, model: row.id })}`).join('\n');
  return <div ref={scope} className={styles.wrapper} data-active={ready ? preset : undefined}>
    <label className={styles.controls}>{copy.settings}
      <select value={preset} onChange={event => setPreset(event.target.value)}>
        {presets.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select></label>
    <p className={styles.guide}>{copy.guide}</p>
    {choices.length > 0 && <div className={styles.selected}>
      <h3>{copy.selection} <small>{choices.length}/3</small></h3>
      <table><thead><tr><th scope="col">{copy.model}</th><th scope="col">{scenario}</th></tr></thead>
        <tbody>{choices.map(row => <tr key={row.id}><th scope="row"><a href={'#' + row.id}>{row.name}</a></th><td>{row.price}</td></tr>)}</tbody></table>
      <div className={styles.actions} key={params.toString()}>
        <PricingCopy text={pageUrl + '#compare?' + params} label={copy.share} copied={copy.copied} manual={copy.manual} />
        <PricingCopy text={'MaxVideoAI · USD · ' + date + '\n' + quote} label={copy.text} copied={copy.copied} manual={copy.manual} />
      </div></div>}
    <div onChange={select}>{children}</div>
  </div>;
}
