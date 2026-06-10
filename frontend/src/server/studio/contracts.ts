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

export type StudioCanvasTemplateRecord = {
  id: string;
  userId: string;
  name: string;
  description: string;
  nodes: unknown[];
  edges: unknown[];
  createdAt: string;
  updatedAt: string;
};
