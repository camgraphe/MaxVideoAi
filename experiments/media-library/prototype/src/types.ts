export type MediaKind = 'image' | 'video' | 'audio';
export type MediaRef = { type: 'asset'; assetId: string; kind: MediaKind };

/** Synthetic records only. Signed transports never become identity. */
export type MediaItem = {
  id: string;
  ref: MediaRef;
  name: string;
  kind: MediaKind;
  width: number;
  height: number;
  durationSec?: number;
  size: number;
  mime: string;
  thumbUrl: string | null;
  previewUrl: string;
  originalUrl: string;
  source: 'upload' | 'generated';
  createdAt: string;
  collectionIds: string[];
  favorite: boolean;
};

export type Collection = { id: string; name: string };
export type ToolTarget = 'image-references' | 'angle' | 'upscale' | 'lip-sync' | 'motion-transfer' | 'subtitles' | 'studio';
export type SelectionIntent = {
  target: ToolTarget;
  title: string;
  role: string;
  kinds: MediaKind[];
  max: number;
};

export type ViewerProps = {
  items: MediaItem[];
  activeId: string;
  onActiveChange: (id: string) => void;
  onClose: () => void;
  onFavorite: (id: string) => void;
  onUse: (item: MediaItem) => void;
  onTrash: (id: string) => void;
  useLabel?: string;
};

export type ImportProps = {
  open: boolean;
  onClose: () => void;
  onImported: (items: MediaItem[]) => void;
};
