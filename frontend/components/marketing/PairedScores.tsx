export type PairedMetric = {
  id: string;
  label: string;
  tooltip?: string;
  leftValue: number | null;
  rightValue: number | null;
};

function validScore(value: number | null) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10 ? value : null;
}

/** One shared 0–10 scale. Values remain readable without motion or JavaScript. */
export function PairedScores({ metrics, naLabel = '—', className = '', motionProgress = { left: 1, right: 1 } }: {
  metrics: PairedMetric[]; naLabel?: string; className?: string; motionProgress?: { left: number; right: number };
}) {
  return <div className={`paired-scores ${className}`}>
    {metrics.map((metric) => {
      const left = validScore(metric.leftValue);
      const right = validScore(metric.rightValue);
      return <div className="paired-row" key={metric.id}><details>
        <summary><span>{metric.label} <span aria-hidden className="text-text-muted">+</span></span><span className="paired-values"><span className="score-left">● {left?.toFixed(1) ?? naLabel}</span><span className="score-right">◆ {right?.toFixed(1) ?? naLabel}</span></span></summary>
        {metric.tooltip ? <p>{metric.tooltip}</p> : null}
        </details>
        <div className="paired-track" aria-hidden>
          {left !== null ? <span className="paired-dot" style={{ left: `${left * 10 * motionProgress.left}%` }} /> : null}
          {right !== null ? <span className="paired-dot right" style={{ left: `${right * 10 * motionProgress.right}%` }} /> : null}
        </div>
        <div className="paired-scale" aria-hidden><span>0</span><span>10</span></div>
      </div>;
    })}
  </div>;
}
