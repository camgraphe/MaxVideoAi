'use client';

import useSWR from 'swr';

type EngineRow = {
  id: string;
  label: string;
  provider: string;
  status: string;
  availability: string;
  latencyTier: string;
  disabled: boolean;
  override: {
    active: boolean;
    availability: string | null;
    status: string | null;
    latencyTier: string | null;
  } | null;
};

type EnginesResponse = {
  ok: boolean;
  engines: EngineRow[];
};

const fetcher = async (url: string): Promise<EnginesResponse> => {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return (await res.json()) as EnginesResponse;
};

export default function AdminEnginesPage() {
  const { data, error, isLoading, mutate } = useSWR<EnginesResponse>('/api/admin/engines', fetcher);

  const unauthorized = error?.message?.includes('Unauthorized') || error?.message?.includes('Forbidden');

  const handleToggle = async (engine: EngineRow, active: boolean) => {
    try {
      const res = await fetch(`/api/admin/engines/${engine.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      await mutate();
    } catch (err) {
      console.error(err);
      alert(`Failed to update engine: ${(err as Error).message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Engines</h2>
        <p className="text-sm text-slate-400">Toggle which engines are displayed in the workspace.</p>
      </div>

      {unauthorized ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          Access denied. Admin sign-in required.
        </div>
      ) : isLoading ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-300">
          Loading…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error.message || 'Failed to load engines.'}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="bg-slate-900/80 text-slate-300">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Engine</th>
                <th className="px-4 py-3 text-left font-medium">Provider</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Availability</th>
                <th className="px-4 py-3 text-left font-medium">Latency</th>
                <th className="px-4 py-3 text-right font-medium">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {data?.engines?.map((engine) => {
                const active = !engine.disabled;
                return (
                  <tr key={engine.id} className="hover:bg-slate-900/60">
                    <td className="px-4 py-3 text-slate-100">
                      <div className="font-medium">{engine.label}</div>
                      <div className="text-xs text-slate-500">{engine.id}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{engine.provider}</td>
                    <td className="px-4 py-3 text-slate-300">{engine.status}</td>
                    <td className="px-4 py-3 text-slate-300">{engine.availability}</td>
                    <td className="px-4 py-3 text-slate-300">{engine.latencyTier}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                          active
                            ? 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                            : 'border border-slate-700 bg-slate-900 text-slate-400'
                        }`}
                        onClick={() => handleToggle(engine, !active)}
                      >
                        {active ? 'On' : 'Off'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
