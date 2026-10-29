'use client';

import { Check, Sparkles } from 'lucide-react';
import { SelectMenu } from '@/components/ui/SelectMenu';
import styles from './prompt-assistance.module.css';

export type MiloReasoning = 'lite' | 'standard' | 'max';
const levels = ['lite', 'standard', 'max'] as const;
const names = { lite: 'Lite', standard: 'Standard', max: 'Max' };

export function MiloReasoningSelect({ locale, value, onChange, live, disabled }: {
  locale: string; value: MiloReasoning; onChange: (value: MiloReasoning) => void; live?: boolean; disabled?: boolean;
}) {
  const copy = locale.startsWith('fr')
    ? { label: 'Niveau d’aide de Milo', lite: 'Aide rapide pour les prompts simples', standard: 'Aide équilibrée au quotidien', max: 'Aide approfondie pour les idées complexes' }
    : locale.startsWith('es')
      ? { label: 'Nivel de ayuda de Milo', lite: 'Ayuda rápida para prompts sencillos', standard: 'Ayuda equilibrada para el día a día', max: 'Ayuda detallada para ideas complejas' }
      : { label: 'Milo assistance level', lite: 'Quick help with simple prompts', standard: 'Balanced help for everyday creation', max: 'Deeper guidance for complex ideas' };

  return <SelectMenu
    value={value} disabled={disabled} onChange={next => { if (levels.some(level => level === next) && (!live || next !== 'lite')) onChange(next as MiloReasoning); }}
    ariaLabel={`${copy.label}: ${names[value]}`}
    triggerLabel={<span className={styles.reasoningLabel}><Sparkles size={15} aria-hidden /><strong>Milo</strong><span>{names[value]}</span></span>}
    className={styles.reasoningControl} buttonClassName={styles.reasoningTrigger}
    menuClassName={`app-experience ${styles.reasoningMenu}`} portal menuPlacement="auto"
    options={levels.filter(level => !live || level !== 'lite').map(level => ({ value: level, label: <span className={styles.reasoningOption}>
      <span><strong>{names[level]}</strong><span>{copy[level]}</span></span>
      {value === level ? <Check size={14} aria-hidden /> : null}
    </span> }))}
  />;
}
