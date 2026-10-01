export type Kind = "image" | "video" | "audio";
export type Track = "video" | "voice" | "music";
export interface Asset {
  id: string;
  name: string;
  kind: Kind;
  file: string;
  original?: string;
  poster?: string;
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
  peaks?: number[];
  origin: "import" | "demo" | "local";
  librarySource?: { projectId: string; assetId: string };
}
export interface LibraryAsset {
  asset: Asset;
  projectId: string;
  projectTitle: string;
}
export interface Clip {
  id: string;
  assetId: string;
  track: Track;
  inFrame: number;
  outFrame: number;
  startFrame: number;
  volume: number;
}
export interface Settings {
  ratio: "16:9" | "9:16" | "1:1";
  resolution: 720 | 1080;
  fps: 24 | 30;
  fit: "cover" | "contain";
  sourceAudio: boolean;
  targetDuration: number;
}
export interface Sequence {
  clips: Clip[];
  settings: Settings;
}
export interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  assets?: string[];
  jobId?: string;
  createdAt: string;
}
export interface Snapshot extends Sequence {
  assets: Asset[];
  title: string;
  revision: number;
}
export interface Job {
  id: string;
  kind: "images" | "animate" | "voice" | "music" | "export";
  state: "queued" | "running" | "ready" | "failed" | "cancelled";
  progress: number;
  label: string;
  error?: string;
  outputIds: string[];
  params: Record<string, unknown>;
  snapshot?: Snapshot;
  createdAt: string;
}
export interface Receipt {
  hash: string;
  revision: number;
  jobId?: string;
}
export interface Project {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  settings: Settings;
  clips: Clip[];
  assets: Asset[];
  messages: Message[];
  jobs: Job[];
  undo: Sequence[];
  redo: Sequence[];
  receipts: Record<string, Receipt>;
  assistantRun?: {
    requestId: string;
    state: "thinking" | "acting" | "failed";
    label: string;
    error?: string;
  };
}
export interface AssistantInfo {
  mode: "demo" | "openai";
  model?: string;
  configured: boolean;
}
export type Command =
  | { type: "settings"; settings: Partial<Settings>; title?: string }
  | {
      type: "insert";
      assetId: string;
      track?: Track;
      index?: number;
      startFrame?: number;
    }
  | { type: "replace"; clipId: string; assetId: string }
  | { type: "trim"; clipId: string; inFrame: number; outFrame: number }
  | { type: "move"; clipId: string; index?: number; startFrame?: number }
  | { type: "volume"; clipId: string; volume: number }
  | { type: "remove"; clipId: string }
  | { type: "assemble"; assetIds: string[] }
  | { type: "undo" | "redo" }
  | { type: "images"; count?: number; prompt?: string; buildFilm?: boolean }
  | {
      type: "animate";
      assetId: string;
      duration: number;
      motion: "gentle" | "pan" | "still";
    }
  | { type: "voice"; text: string }
  | { type: "music"; duration: number }
  | { type: "export" }
  | { type: "cancel" | "retry"; jobId: string };
export interface CommandRequest {
  requestId: string;
  expectedRevision?: number;
  command: Command;
}
export interface CommandResult {
  project: Project;
  jobId?: string;
  replayed?: boolean;
}
