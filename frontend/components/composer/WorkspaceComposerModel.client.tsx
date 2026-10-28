'use client';

import { ChevronDown } from 'lucide-react';
import { EngineIcon } from '@/components/ui/EngineIcon';
import { EngineSelect } from '@/components/ui/EngineSelect';
import type { EngineSelectProps } from '@/components/ui/engine-select/engine-select-types';
import { useI18n } from '@/lib/i18n/I18nProvider';
import styles from './prompt-assistance.module.css';

export function WorkspaceComposerModel(props: EngineSelectProps) {
  const { locale } = useI18n();
  const model = props.engines.find(engine => engine.id === props.engineId);
  const fullName = model?.label ?? props.engineId;
  const buttonName = model?.id === 'seedance-2-0-mini' ? 'Seedance 2 Mini' : fullName;
  const label = locale.startsWith('fr') ? 'Changer de modèle' : locale.startsWith('es') ? 'Cambiar modelo' : 'Change model';
  return <EngineSelect {...props} showModeSelect={false} showBillingNote={false} className={styles.modelControl}
    trigger={{ label: `${label}: ${fullName}`, className: styles.modelTrigger, variantClassName: styles.variantTrigger,
      content: <><span aria-hidden="true" className={styles.modelIcon}><EngineIcon engine={model} size={16} framed={false} /></span><span className={styles.modelName} title={fullName}>{buttonName}</span><ChevronDown size={14} aria-hidden /></> }} />;
}
