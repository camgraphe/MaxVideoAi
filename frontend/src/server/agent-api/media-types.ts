export type AgentMediaItem = {
  assetId: string;
  kind: 'image';
  label: string | null;
  width: number | null;
  height: number | null;
  mimeType: string | null;
  previewUrl: string | null;
  source: 'upload' | 'generated' | 'imported';
  createdAt: string;
};
