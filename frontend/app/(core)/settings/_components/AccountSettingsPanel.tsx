'use client';

import Link from 'next/link';
import { Monitor, Moon, Sun } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { AppLanguageToggle } from '@/components/AppLanguageToggle';
import { Button, ButtonLink } from '@/components/ui/Button';
import { localeLabels } from '@/i18n/locales';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { buildLoginHref } from '@/lib/auth-entry-href';
import { useThemePreference, type ThemePreference } from '@/hooks/useThemePreference';
import { useAccountNameForm } from '../_hooks/useAccountNameForm';

export type AccountSettingsCopy = {
  title: string;
  guest: { description: string; action: string };
  fields: {
    name: { label: string; placeholder: string; help: string };
    email: { label: string; placeholder: string; readOnly: string };
    locale: { label: string; description: string };
    theme: { label: string; description: string; options: Record<ThemePreference, string> };
  };
  actions: { save: string; saving: string; cancel: string };
  validation: { required: string; tooLong: string };
  status: { success: string; genericError: string };
};

const THEME_ICONS = { light: Sun, dark: Moon, system: Monitor };

export function AccountSettingsPanel({ user, copy }: { user: User | null; copy: AccountSettingsCopy }) {
  const { locale } = useI18n();
  const form = useAccountNameForm(user);
  const theme = useThemePreference();
  const loginHref = buildLoginHref({ mode: 'signin', nextPath: '/settings' });

  const messages = { required: copy.validation.required, tooLong: copy.validation.tooLong, generic: copy.status.genericError, success: copy.status.success };

  return (
    <section className="app-account-panel rounded-card border border-border bg-surface p-4 shadow-card sm:p-6">
      <h2 className="text-lg font-semibold text-text-primary">{copy.title}</h2>
      <form className="mt-5 space-y-6" onSubmit={(event) => { event.preventDefault(); void form.save(messages); }}>
        {user ? <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm" htmlFor="settings-account-name">
            <span className="mb-1.5 block font-medium text-text-primary">{copy.fields.name.label}</span>
            <input id="settings-account-name" className="!min-h-11 w-full rounded-input border border-border bg-bg px-3 py-2 text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder={copy.fields.name.placeholder} value={form.name} maxLength={81} disabled={form.busy} aria-invalid={form.validation.error ? true : undefined} aria-describedby="settings-account-name-help" onChange={(event) => form.setName(event.target.value)} />
            <span id="settings-account-name-help" className="mt-1.5 block text-xs text-text-muted">{copy.fields.name.help}</span>
            {form.dirty && form.validation.error ? <span role="alert" className="mt-1 block text-xs text-state-warning">{copy.validation[form.validation.error]}</span> : null}
          </label>
          <label className="text-sm" htmlFor="settings-account-email">
            <span className="mb-1.5 block font-medium text-text-primary">{copy.fields.email.label}</span>
            <input id="settings-account-email" type="email" className="!min-h-11 w-full rounded-input border border-border bg-surface-2 px-3 py-2 text-text-secondary" placeholder={copy.fields.email.placeholder} value={user.email ?? ''} readOnly />
            <span className="mt-1.5 block text-xs text-text-muted">{copy.fields.email.readOnly}</span>
          </label>
        </div> : (
          <div className="rounded-input border border-border bg-bg p-4">
            <p className="text-sm text-text-secondary">{copy.guest.description}</p>
            <ButtonLink href={loginHref} linkComponent={Link} className="mt-3">{copy.guest.action}</ButtonLink>
          </div>
        )}

        <div className="app-preference-row flex flex-wrap items-center gap-3 rounded-input border border-border bg-bg p-3 sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-text-primary">{copy.fields.locale.label}</p>
            <p className="text-xs text-text-muted">{copy.fields.locale.description} <span className="font-medium text-text-secondary">{localeLabels[locale]}</span></p>
          </div>
          <AppLanguageToggle />
        </div>

        <fieldset className="app-preference-row">
          <legend className="text-sm font-medium text-text-primary">{copy.fields.theme.label}</legend>
          <p className="mt-1 text-xs text-text-muted">{copy.fields.theme.description}</p>
          <div className="mt-3 grid grid-cols-1 gap-2 min-[360px]:grid-cols-3">
            {(['light', 'dark', 'system'] as const).map((preference) => {
              const Icon = THEME_ICONS[preference];
              return (
              <Button key={preference} type="button" variant={theme.preference === preference ? 'primary' : 'outline'} aria-pressed={theme.preference === preference} onClick={() => theme.setPreference(preference)} className="app-appearance-choice !min-h-14 gap-2 px-3">
                <Icon className="h-5 w-5 shrink-0" aria-hidden />
                {copy.fields.theme.options[preference]}
              </Button>
              );
            })}
          </div>
        </fieldset>

        {user ? <div>
          {form.status ? <p role={form.status.kind === 'error' ? 'alert' : 'status'} aria-live="polite" className={`mb-3 text-sm ${form.status.kind === 'error' ? 'text-state-warning' : 'text-state-success'}`}>{form.status.message}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={!form.dirty || form.busy || Boolean(form.validation.error)}>{form.busy ? copy.actions.saving : copy.actions.save}</Button>
            <Button type="button" variant="outline" disabled={!form.dirty || form.busy} onClick={form.cancel}>{copy.actions.cancel}</Button>
          </div>
        </div> : null}
      </form>
    </section>
  );
}
