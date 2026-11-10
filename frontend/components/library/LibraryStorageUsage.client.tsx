'use client';
import useSWR from 'swr';
import { HardDrive } from 'lucide-react';
import { ownedAuthFetch } from '@/lib/owned-auth-fetch';
import { CompactLibraryPopup } from './CompactLibraryPopup.client';
type Usage = { recordedBytes: number; measuredFiles: number; totalFiles: number; limitBytes: null; enforcement: false };
export function LibraryStorageUsage({ userId, locale }: { userId: string; locale: string }) {
  const { data, error, mutate } = useSWR(['library-storage', userId], async ([, owner]) => {
    const response = await ownedAuthFetch('/api/media-library/storage', owner);
    const body = await response.json();
    if (!response.ok || !body.ok) throw new Error('STORAGE_UNAVAILABLE');
    return body.usage as Usage;
  }, { keepPreviousData: false, revalidateOnFocus: true });
  const fr = locale.startsWith('fr'), es = locale.startsWith('es');
  const title = fr ? 'Stockage' : es ? 'Almacenamiento' : 'Storage';
  const amount = data ? new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(data.recordedBytes / 1_000_000_000) : null;
  return <div className="library-storage-usage">
    <HardDrive size={14} aria-hidden />
    <CompactLibraryPopup label={`${title} · ${error ? (fr ? 'Indisponible' : es ? 'No disponible' : 'Unavailable') : amount === null ? '…' : `${amount} ${fr ? 'Go' : 'GB'}`}`}>
      <div className="library-storage-details">
        <strong>{title}</strong>
        {error ? <p role="alert">{fr ? 'Mesure indisponible.' : es ? 'Medición no disponible.' : 'Usage unavailable.'} <button type="button" onClick={() => void mutate()}>{fr ? 'Réessayer' : es ? 'Reintentar' : 'Retry'}</button></p> : data ? <>
          <p>{fr ? `${data.measuredFiles.toLocaleString(locale)} fichiers mesurés sur ${data.totalFiles.toLocaleString(locale)}.` : es ? `${data.measuredFiles.toLocaleString(locale)} de ${data.totalFiles.toLocaleString(locale)} archivos medidos.` : `${data.measuredFiles.toLocaleString(locale)} of ${data.totalFiles.toLocaleString(locale)} files measured.`}</p>
          <p>{fr ? 'Estimation des originaux dont la taille est connue, corbeille incluse. Les fichiers non mesurés, vignettes et aperçus ne sont pas comptés.' : es ? 'Estimación de originales con tamaño conocido, incluida la papelera. No incluye archivos sin medir, miniaturas ni vistas previas.' : 'Estimate of originals with a recorded size, including Trash. Unmeasured files, thumbnails and previews are not included.'}</p>
        </> : <p role="status">{fr ? 'Calcul en cours…' : es ? 'Calculando…' : 'Calculating…'}</p>}
        <p>{fr ? 'Aucun quota de stockage appliqué pour le moment.' : es ? 'Todavía no se aplica ninguna cuota de almacenamiento.' : 'No storage quota is currently enforced.'}</p>
      </div>
    </CompactLibraryPopup>
    <span>{fr ? 'Estimation · limite inactive' : es ? 'Estimación · límite inactivo' : 'Estimate · limit inactive'}</span>
  </div>;
}
