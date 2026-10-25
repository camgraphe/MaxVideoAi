import type { MediaInputEligibility } from '@/lib/media-input-eligibility';

export function mediaInputEligibilityMessage(result: MediaInputEligibility, locale = 'en'): string | null {
  const fr = locale.startsWith('fr'); const es = locale.startsWith('es');
  if (result.status === 'excerpt_required' && result.maxDurationExclusive) return fr ? `Choisissez un passage de moins de ${result.maxDurationSec} s après l’ajout.`
    : es ? `Elige un fragmento de menos de ${result.maxDurationSec} s después de añadirlo.` : `Choose a section under ${result.maxDurationSec} s after adding.`;
  if (result.status === 'excerpt_required') return fr ? `Choisissez un passage de ${result.maxDurationSec} s maximum après l’ajout.`
    : es ? `Elige un fragmento de hasta ${result.maxDurationSec} s después de añadirlo.` : `Choose a section up to ${result.maxDurationSec} s after adding.`;
  if (result.status === 'unverified') return fr ? 'Les métadonnées manquantes seront vérifiées avant la génération.'
    : es ? 'Los datos pendientes se verificarán antes de generar.' : 'Missing media details will be verified before generation.';
  if (result.status !== 'blocked') return null;
  if (result.minimumImageSidePx) return fr ? `Choisissez une image d’au moins ${result.minimumImageSidePx} px de chaque côté.`
    : es ? `Elige una imagen de al menos ${result.minimumImageSidePx} px por lado.` : `Choose an image at least ${result.minimumImageSidePx} px on each side.`;
  if (result.durationIssue === 'too-short') return fr ? `Source trop courte. Choisissez au moins ${result.minDurationSec} s.`
    : es ? `Fuente demasiado corta. Elige al menos ${result.minDurationSec} s.` : `Source is too short. Choose at least ${result.minDurationSec} s.`;
  if (result.durationIssue === 'too-long') return fr ? `Source trop longue pour ce rôle. Importez un passage de ${result.maxDurationSec} s maximum.`
    : es ? `Fuente demasiado larga para este rol. Importa un fragmento de hasta ${result.maxDurationSec} s.` : `Source is too long for this role. Import a section up to ${result.maxDurationSec} s.`;
  const messages = {
    mode: ['This role is unavailable in the current workflow.', 'Ce rôle est indisponible dans le mode actuel.', 'Este rol no está disponible en el modo actual.'],
    dimensions: ['Dimensions are incompatible with this role. Choose a different source.', 'Dimensions incompatibles avec ce rôle. Choisissez une autre source.', 'Dimensiones incompatibles con este rol. Elige otra fuente.'],
    kind: ['This role needs a different media type.', 'Ce rôle nécessite un autre type de média.', 'Este rol necesita otro tipo de medio.'],
    size: ['File is too large for this role.', 'Fichier trop volumineux pour ce rôle.', 'Archivo demasiado grande para este rol.'],
    format: ['Format is incompatible with this role.', 'Format incompatible avec ce rôle.', 'Formato incompatible con este rol.'],
    aspect_ratio: ['Image proportions are incompatible with this role.', 'Proportions de l’image incompatibles avec ce rôle.', 'Proporciones de imagen incompatibles con este rol.'],
    duration: ['Duration is incompatible with this role.', 'Durée incompatible avec ce rôle.', 'Duración incompatible con este rol.'],
  };
  return messages[result.issue ?? 'format'][fr ? 1 : es ? 2 : 0];
}
