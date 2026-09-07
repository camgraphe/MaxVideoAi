'use client';
import { useState, type Ref } from 'react';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { MediaActionPanel } from './MediaActionPanel.client';
import { MediaDestinationActions } from './MediaDestinationActions.client';
import type { AssetBrowserAsset } from './AssetLibraryBrowser';
export function GalleryMediaActionPanel({ assets, onClose, menuRef, onPreview, onRemake, onSave, onCopy }: {
  assets: AssetBrowserAsset[]; onClose: () => void; menuRef: Ref<HTMLDivElement>;
  onPreview: () => void; onRemake?: () => void; onSave?: () => void; onCopy?: () => void;
}) {
  const { user } = useRequireAuth({ redirectIfLoggedOut: false });
  const { locale } = useI18n();
  const [index, setIndex] = useState(0);
  const asset = assets[index] ?? assets[0];
  const labels = locale.startsWith('fr') ? ['Voir le résultat', 'Reprendre les paramètres', 'Sauvegarder le résultat principal', 'Copier le lien principal', 'Sortie'] : locale.startsWith('es') ? ['Ver resultado', 'Recuperar ajustes', 'Guardar resultado principal', 'Copiar enlace principal', 'Resultado'] : ['View result', 'Reuse settings', 'Save main output', 'Copy main output link', 'Output'];
  return <MediaActionPanel boundaryRef={menuRef} asset={asset} locale={locale} onClose={onClose}>
    {assets.length > 1 ? <label>{labels[4]}<select value={index} onChange={(event) => setIndex(Number(event.target.value))}>{assets.map((entry, position) => <option value={position} key={entry.id}>{labels[4]} {position + 1}</option>)}</select></label> : null}
    <MediaDestinationActions key={asset.id} asset={asset} userId={user?.id} locale={locale} onNavigate={onClose} />
    <button type="button" onClick={onPreview}>{labels[0]}</button>
    {onRemake ? <button type="button" onClick={onRemake}>{labels[1]}</button> : null}
    {onSave ? <button type="button" onClick={onSave}>{labels[2]}</button> : null}
    {onCopy ? <button type="button" onClick={onCopy}>{labels[3]}</button> : null}
  </MediaActionPanel>;
}
