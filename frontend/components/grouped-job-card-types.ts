export type GroupedJobAction =
  | 'open'
  | 'view'
  | 'download'
  | 'copy'
  | 'continue'
  | 'refine'
  | 'branch'
  | 'compare'
  | 'remove'
  | 'save-image'
  | 'save-to-library';

export type GroupedJobMenuVariant = 'full' | 'compact' | 'gallery' | 'gallery-image';
