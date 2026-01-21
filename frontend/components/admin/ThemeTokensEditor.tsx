'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import clsx from 'clsx';
import { Button } from '@/components/ui/Button';
import {
  THEME_TOKEN_DEFS,
  THEME_TOKEN_GROUPS,
  buildThemeTokensStyle,
  type ThemeTokenDefinition,
  type ThemeTokenGroup,
  type ThemeTokensSetting,
} from '@/lib/theme-tokens';

type ThemeTokensEditorProps = {
  initialSetting: ThemeTokensSetting;
};

type ThemeMode = 'light' | 'dark';

const MODE_LABELS: Record<ThemeMode, string> = {
  light: 'Light',
  dark: 'Dark',
};

export function ThemeTokensEditor({ initialSetting }: ThemeTokensEditorProps) {
  const [mode, setMode] = useState<ThemeMode>('light');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [search, setSearch] = useState('');
  const [values, setValues] = useState<ThemeTokensSetting>(() => ({
    light: { ...initialSetting.light },
    dark: { ...initialSetting.dark },
  }));
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const styleRef = useRef<HTMLStyleElement | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    const light = resolveComputedTokens('light');
    const dark = resolveComputedTokens('dark');
    setValues((prev) => ({
      light: { ...light, ...prev.light },
      dark: { ...dark, ...prev.dark },
    }));
    initializedRef.current = true;
  }, []);

  useEffect(() => {
    if (!initializedRef.current) return;
    const css = buildThemeTokensStyle(values);
    let styleEl = styleRef.current;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'theme-token-preview';
      document.head.appendChild(styleEl);
      styleRef.current = styleEl;
    }
    styleEl.textContent = css;
  }, [values]);

  useEffect(() => {
    if (mode === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [mode]);

  useEffect(() => {
    return () => {
      if (styleRef.current) {
        styleRef.current.remove();
        styleRef.current = null;
      }
    };
  }, []);

  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const tokensByGroup = new Map<string, ThemeTokenDefinition[]>();
    THEME_TOKEN_DEFS.forEach((token) => {
      if (!showAdvanced && token.advanced) return;
      if (term && !token.label.toLowerCase().includes(term) && !token.key.includes(term)) return;
      const list = tokensByGroup.get(token.group) ?? [];
      list.push(token);
      tokensByGroup.set(token.group, list);
    });
    return THEME_TOKEN_GROUPS.filter((group) => {
      if (!showAdvanced && group.advanced) return false;
      return tokensByGroup.has(group.id);
    }).map((group) => ({
      group,
      tokens: tokensByGroup.get(group.id) ?? [],
    }));
  }, [search, showAdvanced]);

  const handleValueChange = (key: string, nextValue: string) => {
    setValues((prev) => ({
      ...prev,
      [mode]: {
        ...prev[mode],
        [key]: nextValue,
      },
    }));
    setStatus('idle');
    setError(null);
  };

  const handleSave = () => {
    startTransition(async () => {
      setStatus('idle');
      setError(null);
      try {
        const response = await fetch('/api/admin/theme-tokens', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error ?? 'Impossible de sauvegarder le theme.');
        }
        setStatus('success');
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Impossible de sauvegarder le theme.');
      }
    });
  };

  const handleReload = () => {
    const light = resolveComputedTokens('light');
    const dark = resolveComputedTokens('dark');
    setValues({ light, dark });
    setStatus('idle');
    setError(null);
  };

  const handleReset = () => {
    startTransition(async () => {
      setStatus('idle');
      setError(null);
      try {
        const response = await fetch('/api/admin/theme-tokens', { method: 'DELETE' });
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error ?? 'Impossible de reinitialiser le theme.');
        }
        handleReload();
        setStatus('success');
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Impossible de reinitialiser le theme.');
      }
    });
  };

  return (
    <div className="grid grid-gap-lg xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-card border border-border bg-surface p-6 shadow-card">
        <header className="stack-gap-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-text-muted">Theme tokens</p>
          <h1 className="text-2xl font-semibold text-text-primary">Personnalisation globale</h1>
          <p className="text-sm text-text-secondary">
            Ajustez les tokens UI pour tous les ecrans. Les changements sont appliques immediatement sur cette page,
            puis sauvegardes pour l'ensemble du site.
          </p>
        </header>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-hairline bg-surface-2 p-1">
            {(['light', 'dark'] as ThemeMode[]).map((target) => (
              <button
                key={target}
                type="button"
                onClick={() => setMode(target)}
                className={clsx(
                  'rounded-full px-3 py-1 text-xs font-semibold',
                  mode === target ? 'bg-brand text-on-brand' : 'text-text-secondary hover:text-text-primary'
                )}
              >
                {MODE_LABELS[target]}
              </button>
            ))}
          </div>

          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher un token..."
            className="min-w-[220px] flex-1 rounded-input border border-border bg-surface-glass-80 px-3 py-2 text-sm text-text-primary shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />

          <label className="inline-flex items-center gap-2 text-xs font-semibold text-text-secondary">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border text-brand focus:ring-ring"
              checked={showAdvanced}
              onChange={(event) => setShowAdvanced(event.target.checked)}
            />
            Afficher les reglages avances
          </label>
        </div>

        <div className="mt-6 space-y-6">
          {filteredGroups.map(({ group, tokens }) => (
            <TokenGroup key={group.id} group={group} tokens={tokens} values={values[mode]} onChange={handleValueChange} />
          ))}
        </div>

        {status === 'success' ? (
          <div className="mt-6 rounded-input border border-success-border bg-success-bg px-3 py-2 text-sm text-success">
            Theme sauvegarde.
          </div>
        ) : null}
        {error ? (
          <div className="mt-6 rounded-input border border-warning-border bg-warning-bg px-3 py-2 text-sm text-warning">
            {error}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Button type="button" size="sm" onClick={handleSave} disabled={isPending}>
            {isPending ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleReload}
            disabled={isPending}
            className="text-text-secondary"
          >
            Recharger depuis la page
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleReset}
            disabled={isPending}
            className="text-text-secondary"
          >
            Reinitialiser
          </Button>
        </div>
      </section>

      <aside
        className="rounded-card border border-border bg-surface p-6 shadow-card"
        data-theme={mode === 'dark' ? 'dark' : undefined}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-text-muted">Preview</p>
        <h2 className="mt-2 text-lg font-semibold text-text-primary">Carte de reference</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Exemple rapide pour valider les surfaces, textes, boutons et ombres.
        </p>
        <div className="mt-4 space-y-3">
          <div className="rounded-card border border-border bg-surface-2 p-4">
            <p className="text-sm font-semibold text-text-primary">Card title</p>
            <p className="mt-1 text-xs text-text-muted">Secondary copy on surface 2.</p>
          </div>
          <div className="rounded-card border border-hairline bg-surface-3 p-4">
            <p className="text-sm text-text-secondary">Supporting panel</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="rounded-input">
              Primary CTA
            </Button>
            <Button size="sm" variant="outline">
              Secondary
            </Button>
            <span className="inline-flex items-center rounded-full bg-accent px-3 py-1 text-xs font-semibold text-on-accent">
              Accent
            </span>
          </div>
          <div className="rounded-card border border-border bg-surface p-4 shadow-card">
            <p className="text-xs uppercase tracking-micro text-text-muted">Focus ring</p>
            <div className="mt-2 rounded-input border border-border bg-surface-2 px-3 py-2 text-sm text-text-primary outline outline-2 outline-offset-2 outline-ring">
              Input sample
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function TokenGroup({
  group,
  tokens,
  values,
  onChange,
}: {
  group: ThemeTokenGroup;
  tokens: ThemeTokenDefinition[];
  values: Record<string, string>;
  onChange: (key: string, nextValue: string) => void;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-text-muted">{group.label}</h3>
        {group.advanced ? <span className="text-xs text-text-muted">Advanced</span> : null}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {tokens.map((token) => (
          <TokenInput key={token.key} token={token} value={values[token.key] ?? ''} onChange={onChange} />
        ))}
      </div>
    </section>
  );
}

function TokenInput({
  token,
  value,
  onChange,
}: {
  token: ThemeTokenDefinition;
  value: string;
  onChange: (key: string, nextValue: string) => void;
}) {
  const showColor = token.input === 'color';
  const showNumber = token.input === 'number';
  const numericValue = showNumber ? toNumberValue(value, token.unit ?? '') : value;
  const colorValue = showColor && isHexColor(value) ? value : '#000000';

  return (
    <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
      <span className="flex items-center justify-between gap-2">
        <span>{token.label}</span>
        <span className="rounded-full border border-hairline bg-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-text-secondary">
          --{token.key}
        </span>
      </span>
      <div className="flex items-center gap-2 rounded-input border border-border bg-surface-glass-80 px-2 py-1.5 shadow-inner">
        {showColor ? (
          <input
            type="color"
            value={colorValue}
            onChange={(event) => onChange(token.key, event.target.value)}
            className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent"
            aria-label={`${token.label} color`}
          />
        ) : (
          <span
            className="h-8 w-10 rounded border border-border"
            style={{ background: value || 'transparent' }}
            aria-hidden
          />
        )}
        <input
          type={showNumber ? 'number' : 'text'}
          step={showNumber && token.unit === 'ms' ? 10 : showNumber ? 1 : undefined}
          value={showNumber ? numericValue : value}
          onChange={(event) => {
            const nextValue = showNumber
              ? withUnit(event.target.value, token.unit ?? '')
              : event.target.value;
            onChange(token.key, nextValue);
          }}
          className="w-full bg-transparent text-sm font-medium text-text-primary focus-visible:outline-none"
          placeholder={token.unit ? `ex: 16${token.unit}` : 'ex: #FFFFFF / rgba(0,0,0,0.2)'}
        />
      </div>
    </label>
  );
}

function isHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value.trim());
}

function withUnit(value: string, unit: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (!unit) return trimmed;
  if (trimmed.endsWith(unit)) return trimmed;
  return `${trimmed}${unit}`;
}

function toNumberValue(value: string, unit: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (unit && trimmed.endsWith(unit)) {
    return trimmed.slice(0, -unit.length);
  }
  return trimmed;
}

function resolveComputedTokens(mode: ThemeMode) {
  if (mode === 'light') {
    const root = document.documentElement;
    const previousTheme = root.getAttribute('data-theme');
    if (previousTheme !== null) {
      root.removeAttribute('data-theme');
    }
    const styles = getComputedStyle(root);
    const output: Record<string, string> = {};
    THEME_TOKEN_DEFS.forEach((token) => {
      const value = styles.getPropertyValue(`--${token.key}`).trim();
      if (value) {
        output[token.key] = value;
      }
    });
    if (previousTheme !== null) {
      root.setAttribute('data-theme', previousTheme);
    }
    return output;
  }

  const target = createDarkProbe();
  const styles = getComputedStyle(target);
  const output: Record<string, string> = {};
  THEME_TOKEN_DEFS.forEach((token) => {
    const value = styles.getPropertyValue(`--${token.key}`).trim();
    if (value) {
      output[token.key] = value;
    }
  });
  target.remove();
  return output;
}

function createDarkProbe() {
  const probe = document.createElement('div');
  probe.setAttribute('data-theme', 'dark');
  probe.style.position = 'fixed';
  probe.style.pointerEvents = 'none';
  probe.style.opacity = '0';
  document.body.appendChild(probe);
  return probe;
}
