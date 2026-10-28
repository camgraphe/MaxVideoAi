'use client';

import { ChevronDown } from 'lucide-react';
import { EngineSelect } from '@/components/ui/EngineSelect';
import type { EngineSelectProps } from '@/components/ui/engine-select/engine-select-types';
import { useI18n } from '@/lib/i18n/I18nProvider';
import styles from './prompt-assistance.module.css';

export function WorkspaceComposerModel(props: EngineSelectProps) {
  const { locale } = useI18n();
  const model = props.engines.find(engine => engine.id === props.engineId);
  const label = locale.startsWith('fr') ? 'Changer de modèle' : locale.startsWith('es') ? 'Cambiar modelo' : 'Change model';
  return <EngineSelect {...props} showModeSelect={false} showBillingNote={false} className={styles.modelControl}
    trigger={{ label: `${label}: ${model?.label ?? props.engineId}`, className: styles.modelTrigger,
      content: <><span>{model?.label ?? props.engineId}</span><ChevronDown size={14} aria-hidden /></> }} />;
}
