export type AngleToolEngineId = 'flux-multiple-angles' | 'qwen-multiple-angles';

export type AngleToolPresetId = 'dialogue' | 'product' | 'action';

export interface AngleToolNumericParams {
  rotation: number;
  tilt: number;
  zoom: number;
}

export interface AngleToolRequest {
  imageUrl: string;
  engineId?: AngleToolEngineId;
  params: AngleToolNumericParams;
  safeMode?: boolean;
  generateBestAngles?: boolean;
  imageWidth?: number;
  imageHeight?: number;
}

export interface AngleToolOutput {
  url: string;
  width?: number | null;
  height?: number | null;
  mimeType?: string | null;
}

export interface AngleToolPricing {
  estimatedCostUsd: number;
  actualCostUsd?: number | null;
  currency?: string;
  estimatedCredits: number;
  actualCredits?: number | null;
}

export interface AngleToolResponse {
  ok: boolean;
  engineId: AngleToolEngineId;
  engineLabel: string;
  requestedOutputCount: number;
  requestId?: string | null;
  providerJobId?: string | null;
  latencyMs: number;
  pricing: AngleToolPricing;
  requested: AngleToolNumericParams;
  applied: AngleToolNumericParams & {
    safeMode: boolean;
    safeApplied: boolean;
  };
  outputs: AngleToolOutput[];
  error?: {
    code: string;
    message: string;
    detail?: unknown;
  };
}

export type AngleEngineInputStyle = 'multiple-angles';

export interface AngleToolEngineDefinition {
  id: AngleToolEngineId;
  label: string;
  description: string;
  falModelId: string;
  inputStyle: AngleEngineInputStyle;
  estimatedCostUsdPerMp: number;
  supportsMultiOutput: boolean;
}
