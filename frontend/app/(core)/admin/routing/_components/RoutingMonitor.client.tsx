'use client';

import { Activity, ArrowDownRight, Check, CircleAlert, CornerDownRight, Gauge, ListTree, Minus, X } from 'lucide-react';
import styles from './RoutingMonitor.module.css';

type Offer = { label: string; costMicros: number | null; excluded: string | null; selected: boolean };
type Event = { title: string; detail: string; tone: string };
type Count = { label: string; count: number };

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 6,
});

function price(micros: number) {
  return usd.format(micros / 1_000_000);
}

const stateIcons: Record<string, typeof Minus> = { success: Check, failure: X, warning: CircleAlert, fallback: CornerDownRight, active: ArrowDownRight };

function Mark({ tone }: { tone: string }) {
  const Icon = Object.hasOwn(stateIcons, tone) ? stateIcons[tone] : Minus;
  return <span className={styles.mark} data-tone={tone} aria-hidden="true"><Icon size={12} strokeWidth={2} /></span>;
}

function Bar({ value, scale, threshold, tone }: { value: number; scale: number; threshold?: number; tone: string }) {
  const percentage = (amount: number) => scale > 0 ? Math.min(100, Math.max(0, amount / scale * 100)) : 0;
  return (
    <span className={styles.track} aria-hidden="true">
      <span className={styles.bar} data-tone={tone} style={{ width: `${percentage(value)}%` }} />
      {threshold !== undefined && threshold < scale && (
        <span className={styles.limit} style={{ left: `${percentage(threshold)}%` }} />
      )}
    </span>
  );
}

export function RoutingMonitor({ offers = [], ceilingMicros, events, observed, counts = [] }: {
  offers?: ReadonlyArray<Offer>;
  ceilingMicros?: number;
  events: ReadonlyArray<Event>;
  observed: boolean;
  counts?: ReadonlyArray<Count>;
}) {
  const ordered = [...offers].sort((a, b) =>
    Number(Boolean(a.excluded)) - Number(Boolean(b.excluded)) ||
    (a.costMicros ?? Infinity) - (b.costMicros ?? Infinity) || a.label.localeCompare(b.label));
  const ceiling = ceilingMicros !== undefined && Number.isFinite(ceilingMicros) && ceilingMicros >= 0 ? ceilingMicros : undefined;
  const priceScale = Math.max(ceiling ?? 0, ...offers.map(offer => offer.costMicros ?? 0));
  const volumes = [...counts].filter(item => item.count > 0).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const empty = observed ? !volumes.length : !ordered.length;
  return (
    <div className={styles.monitor}>
      <section className={styles.panel} aria-label={observed ? 'Recent provider activity' : 'Decision log'}>
        <h3 className={styles.heading}><ListTree size={14} aria-hidden="true" />{observed ? 'Recent provider activity' : 'Decision log'}</h3>
        {events.length > 0 ? (
          <ol className={styles.log}>
            {events.slice(0, 4).map((event, index) => (
              <li key={index}>
                <Mark tone={event.tone} />
                <div><strong>{event.title}</strong>{event.detail && <small>{event.detail}</small>}</div>
              </li>
            ))}
          </ol>
        ) : <p className={styles.empty}>{observed ? 'No recorded events for this view.' : 'Waiting for the first routing decision.'}</p>}
      </section>
      <section className={styles.panel} aria-label={observed ? 'Provider volume' : 'Supplier estimates'}>
        <div className={styles.header}>
          <h3 className={styles.heading}>{observed ? <Activity size={14} aria-hidden="true" /> : <Gauge size={14} aria-hidden="true" />}
            {observed ? 'Provider volume' : 'Supplier estimates'}
          </h3>
          {!observed && ceiling !== undefined && <span className={styles.ceiling}>Ceiling <b>{price(ceiling)}</b></span>}
        </div>
        {empty && <p className={styles.empty}>{observed ? 'No provider records in this view.' : 'No offers for this request.'}</p>}
        {observed && !empty && (
          <ol className={styles.measures}>
            {volumes.map(row => (
              <li key={row.label}>
                <div className={styles.caption}><span>{row.label}</span><b>{row.count} {row.count === 1 ? 'record' : 'records'}</b></div>
                <Bar value={row.count} scale={volumes[0].count} tone="volume" />
              </li>
            ))}
          </ol>
        )}
        {!observed && !empty && (
          <ol className={styles.measures}>
            {ordered.map(row => (
              <li key={row.label}>
                <div className={styles.caption}>
                  <span>{row.label}{row.selected && !row.excluded && <em>Selected</em>}</span>
                  <b>{row.costMicros !== null ? price(row.costMicros) : 'Unpriced'}</b>
                </div>
                {row.costMicros !== null && <Bar value={row.costMicros} scale={priceScale} threshold={ceiling}
                  tone={row.excluded ? 'excluded' : row.selected ? 'selected' : 'offer'} />}
                {row.excluded && <small className={styles.reason}>{row.excluded}</small>}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
