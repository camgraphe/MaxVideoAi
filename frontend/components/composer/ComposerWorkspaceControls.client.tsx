'use client';

import { createContext, useContext, type ComponentProps, type ReactNode } from 'react';
import { AppNavigation } from '@/components/app/AppNavigation.client';
import { PROMPT_ASSISTANCE_PREVIEW } from '@/lib/prompt-assistance/preview-state';
import { ComposerModeSwitch } from './ComposerModeSwitch.client';
import styles from './prompt-assistance.module.css';

const Controls = createContext<{ modelControl: ReactNode } | null>(null);

/** Presentation slots only. The route retains model, availability and quote ownership. */
export function ComposerWorkspaceControls({ modelControl, children }: { modelControl: ReactNode; children: ReactNode }) {
  return <Controls.Provider value={PROMPT_ASSISTANCE_PREVIEW ? { modelControl } : null}>{children}</Controls.Provider>;
}

export const useComposerWorkspaceControls = () => useContext(Controls);

export function ComposerCommandBar({ modes, ...props }: Omit<ComponentProps<typeof ComposerModeSwitch>, 'modes'> & { modes?: ComponentProps<typeof ComposerModeSwitch>['modes'] | null }) {
  const controls = useComposerWorkspaceControls();
  if (!controls) return modes ? <ComposerModeSwitch modes={modes} {...props} /> : null;
  return <div className={styles.commandBar} data-composer-command-bar>
    <AppNavigation variant="activities" placement="composer" />
    {modes ? <ComposerModeSwitch modes={modes} {...props} compact /> : null}
  </div>;
}
