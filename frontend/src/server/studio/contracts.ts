export type StudioProjectRecord = {
  id: string;
  userId: string;
  name: string;
  canvasTemplateId: string;
  settings: unknown;
  workspaceState: unknown;
  createdAt: string;
  updatedAt: string;
};

export type StudioSequenceRecord = {
  id: string;
  userId: string;
  projectId: string;
  name: string;
  settings: unknown;
  timelineState: unknown;
  createdAt: string;
  updatedAt: string;
};
