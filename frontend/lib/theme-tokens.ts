export type ThemeTokenInput = 'color' | 'text' | 'number';

export type ThemeTokenDefinition = {
  key: string;
  label: string;
  group: string;
  input: ThemeTokenInput;
  unit?: string;
  advanced?: boolean;
  hint?: string;
};

export type ThemeTokenGroup = {
  id: string;
  label: string;
  advanced?: boolean;
};

export type ThemeTokenValues = Record<string, string>;

export type ThemeTokensSetting = {
  light: ThemeTokenValues;
  dark: ThemeTokenValues;
};

export type ThemeTokenValidationError = {
  mode: 'light' | 'dark';
  key: string;
  value: string;
  reason: string;
};

export const EMPTY_THEME_TOKENS: ThemeTokensSetting = Object.freeze({
  light: {},
  dark: {},
});

export const THEME_TOKEN_GROUPS: ThemeTokenGroup[] = [
  { id: 'surfaces', label: 'Surfaces' },
  { id: 'text', label: 'Text' },
  { id: 'borders', label: 'Borders' },
  { id: 'brand', label: 'Brand & accent' },
  { id: 'overlays', label: 'Overlays' },
  { id: 'shadows', label: 'Shadows' },
  { id: 'radius', label: 'Radius' },
  { id: 'spacing', label: 'Spacing' },
  { id: 'sizing', label: 'Sizing' },
  { id: 'states', label: 'States', advanced: true },
  { id: 'glass', label: 'Glass surfaces', advanced: true },
  { id: 'on-media', label: 'On-media surfaces', advanced: true },
  { id: 'on-media-text', label: 'On-media text', advanced: true },
  { id: 'on-media-dark', label: 'On-media dark scrims', advanced: true },
  { id: 'preview', label: 'Preview outlines', advanced: true },
  { id: 'semantic', label: 'Semantic states', advanced: true },
  { id: 'links', label: 'Links', advanced: true },
  { id: 'placeholders', label: 'Placeholders', advanced: true },
  { id: 'charts', label: 'Charts', advanced: true },
  { id: 'motion', label: 'Motion', advanced: true },
  { id: 'opacity', label: 'Opacity', advanced: true },
  { id: 'z-index', label: 'Z-index', advanced: true },
  { id: 'borders-advanced', label: 'Borders (advanced)', advanced: true },
  { id: 'spacing-scale', label: 'Spacing scale', advanced: true },
  { id: 'typography-scale', label: 'Typography scale', advanced: true },
  { id: 'engines', label: 'Engine colors', advanced: true },
];

export const THEME_TOKEN_DEFS: ThemeTokenDefinition[] = [
  { key: 'bg', label: 'Background', group: 'surfaces', input: 'color' },
  { key: 'surface', label: 'Surface', group: 'surfaces', input: 'color' },
  { key: 'surface-2', label: 'Surface 2', group: 'surfaces', input: 'color' },
  { key: 'surface-3', label: 'Surface 3', group: 'surfaces', input: 'color' },
  { key: 'surface-hover', label: 'Surface hover', group: 'surfaces', input: 'color' },
  { key: 'surface-disabled', label: 'Surface disabled', group: 'surfaces', input: 'color' },
  { key: 'text-primary', label: 'Text primary', group: 'text', input: 'color' },
  { key: 'text-secondary', label: 'Text secondary', group: 'text', input: 'color' },
  { key: 'text-muted', label: 'Text muted', group: 'text', input: 'color' },
  { key: 'text-disabled', label: 'Text disabled', group: 'text', input: 'color' },
  { key: 'on-surface', label: 'On surface', group: 'text', input: 'color' },
  { key: 'on-surface-muted', label: 'On surface muted', group: 'text', input: 'color' },
  { key: 'on-inverse', label: 'On inverse', group: 'text', input: 'color' },
  { key: 'border', label: 'Border', group: 'borders', input: 'color' },
  { key: 'hairline', label: 'Hairline', group: 'borders', input: 'color' },
  { key: 'border-hover', label: 'Border hover', group: 'borders', input: 'color' },
  { key: 'border-disabled', label: 'Border disabled', group: 'borders', input: 'color' },
  { key: 'brand', label: 'Brand', group: 'brand', input: 'color' },
  { key: 'brand-hover', label: 'Brand hover', group: 'brand', input: 'color' },
  { key: 'brand-active', label: 'Brand active', group: 'brand', input: 'color' },
  { key: 'on-brand', label: 'On brand', group: 'brand', input: 'color' },
  { key: 'accent', label: 'Accent', group: 'brand', input: 'color' },
  { key: 'accent-hover', label: 'Accent hover', group: 'brand', input: 'color' },
  { key: 'accent-active', label: 'Accent active', group: 'brand', input: 'color' },
  { key: 'accent-subtle', label: 'Accent subtle', group: 'brand', input: 'color' },
  { key: 'on-accent', label: 'On accent', group: 'brand', input: 'color' },
  { key: 'accent-alt', label: 'Accent alt', group: 'brand', input: 'color' },
  { key: 'accent-alt-hover', label: 'Accent alt hover', group: 'brand', input: 'color' },
  { key: 'accent-alt-active', label: 'Accent alt active', group: 'brand', input: 'color' },
  { key: 'accent-alt-subtle', label: 'Accent alt subtle', group: 'brand', input: 'color' },
  { key: 'on-accent-alt', label: 'On accent alt', group: 'brand', input: 'color' },
  { key: 'ring', label: 'Focus ring', group: 'brand', input: 'text' },
  { key: 'overlay-bg', label: 'Overlay background', group: 'overlays', input: 'text' },
  { key: 'overlay-surface', label: 'Overlay surface', group: 'overlays', input: 'color' },
  { key: 'overlay-ink', label: 'Overlay ink', group: 'overlays', input: 'color' },
  { key: 'overlay-muted', label: 'Overlay muted', group: 'overlays', input: 'color' },
  { key: 'shadow-card', label: 'Shadow card', group: 'shadows', input: 'text' },
  { key: 'shadow-float', label: 'Shadow float', group: 'shadows', input: 'text' },
  { key: 'radius-card', label: 'Radius card', group: 'radius', input: 'number', unit: 'px' },
  { key: 'radius-input', label: 'Radius input', group: 'radius', input: 'number', unit: 'px' },
  { key: 'radius-xl', label: 'Radius XL', group: 'radius', input: 'number', unit: 'px' },
  { key: 'section-padding-y', label: 'Section padding Y', group: 'spacing', input: 'number', unit: 'px' },
  { key: 'stack-gap', label: 'Stack gap', group: 'spacing', input: 'number', unit: 'px' },
  { key: 'grid-gap', label: 'Grid gap', group: 'spacing', input: 'number', unit: 'px' },
  { key: 'card-pad', label: 'Card padding', group: 'spacing', input: 'number', unit: 'px' },
  { key: 'button-height', label: 'Button height', group: 'sizing', input: 'number', unit: 'px' },
  { key: 'input-height', label: 'Input height', group: 'sizing', input: 'number', unit: 'px' },
  { key: 'icon-size', label: 'Icon size', group: 'sizing', input: 'number', unit: 'px' },
  { key: 'link', label: 'Link', group: 'links', input: 'color', advanced: true },
  { key: 'link-hover', label: 'Link hover', group: 'links', input: 'color', advanced: true },
  { key: 'placeholder', label: 'Placeholder', group: 'placeholders', input: 'color', advanced: true },
  { key: 'skeleton', label: 'Skeleton', group: 'placeholders', input: 'color', advanced: true },
  { key: 'preview-outline-idle', label: 'Preview outline idle', group: 'preview', input: 'text', advanced: true },
  { key: 'preview-outline-hover', label: 'Preview outline hover', group: 'preview', input: 'text', advanced: true },
  { key: 'preview-outline-active', label: 'Preview outline active', group: 'preview', input: 'text', advanced: true },
  { key: 'success', label: 'Success', group: 'semantic', input: 'color', advanced: true },
  { key: 'success-bg', label: 'Success bg', group: 'semantic', input: 'text', advanced: true },
  { key: 'success-border', label: 'Success border', group: 'semantic', input: 'text', advanced: true },
  { key: 'on-success', label: 'On success', group: 'semantic', input: 'color', advanced: true },
  { key: 'warning', label: 'Warning', group: 'semantic', input: 'color', advanced: true },
  { key: 'warning-bg', label: 'Warning bg', group: 'semantic', input: 'text', advanced: true },
  { key: 'warning-border', label: 'Warning border', group: 'semantic', input: 'text', advanced: true },
  { key: 'on-warning', label: 'On warning', group: 'semantic', input: 'color', advanced: true },
  { key: 'error', label: 'Error', group: 'semantic', input: 'color', advanced: true },
  { key: 'error-bg', label: 'Error bg', group: 'semantic', input: 'text', advanced: true },
  { key: 'error-border', label: 'Error border', group: 'semantic', input: 'text', advanced: true },
  { key: 'on-error', label: 'On error', group: 'semantic', input: 'color', advanced: true },
  { key: 'info', label: 'Info', group: 'semantic', input: 'color', advanced: true },
  { key: 'info-bg', label: 'Info bg', group: 'semantic', input: 'text', advanced: true },
  { key: 'info-border', label: 'Info border', group: 'semantic', input: 'text', advanced: true },
  { key: 'on-info', label: 'On info', group: 'semantic', input: 'color', advanced: true },
  { key: 'surface-glass-95', label: 'Glass 95', group: 'glass', input: 'text', advanced: true },
  { key: 'surface-glass-90', label: 'Glass 90', group: 'glass', input: 'text', advanced: true },
  { key: 'surface-glass-85', label: 'Glass 85', group: 'glass', input: 'text', advanced: true },
  { key: 'surface-glass-80', label: 'Glass 80', group: 'glass', input: 'text', advanced: true },
  { key: 'surface-glass-75', label: 'Glass 75', group: 'glass', input: 'text', advanced: true },
  { key: 'surface-glass-70', label: 'Glass 70', group: 'glass', input: 'text', advanced: true },
  { key: 'surface-glass-60', label: 'Glass 60', group: 'glass', input: 'text', advanced: true },
  { key: 'surface-on-media-5', label: 'On-media 5', group: 'on-media', input: 'text', advanced: true },
  { key: 'surface-on-media-10', label: 'On-media 10', group: 'on-media', input: 'text', advanced: true },
  { key: 'surface-on-media-15', label: 'On-media 15', group: 'on-media', input: 'text', advanced: true },
  { key: 'surface-on-media-20', label: 'On-media 20', group: 'on-media', input: 'text', advanced: true },
  { key: 'surface-on-media-25', label: 'On-media 25', group: 'on-media', input: 'text', advanced: true },
  { key: 'surface-on-media-30', label: 'On-media 30', group: 'on-media', input: 'text', advanced: true },
  { key: 'surface-on-media-40', label: 'On-media 40', group: 'on-media', input: 'text', advanced: true },
  { key: 'surface-on-media-50', label: 'On-media 50', group: 'on-media', input: 'text', advanced: true },
  { key: 'surface-on-media-60', label: 'On-media 60', group: 'on-media', input: 'text', advanced: true },
  { key: 'surface-on-media-70', label: 'On-media 70', group: 'on-media', input: 'text', advanced: true },
  { key: 'text-on-media-95', label: 'Text on media 95', group: 'on-media-text', input: 'text', advanced: true },
  { key: 'text-on-media-90', label: 'Text on media 90', group: 'on-media-text', input: 'text', advanced: true },
  { key: 'text-on-media-85', label: 'Text on media 85', group: 'on-media-text', input: 'text', advanced: true },
  { key: 'text-on-media-80', label: 'Text on media 80', group: 'on-media-text', input: 'text', advanced: true },
  { key: 'text-on-media-70', label: 'Text on media 70', group: 'on-media-text', input: 'text', advanced: true },
  { key: 'surface-on-media-dark-5', label: 'Dark scrim 5', group: 'on-media-dark', input: 'text', advanced: true },
  { key: 'surface-on-media-dark-10', label: 'Dark scrim 10', group: 'on-media-dark', input: 'text', advanced: true },
  { key: 'surface-on-media-dark-40', label: 'Dark scrim 40', group: 'on-media-dark', input: 'text', advanced: true },
  { key: 'surface-on-media-dark-45', label: 'Dark scrim 45', group: 'on-media-dark', input: 'text', advanced: true },
  { key: 'surface-on-media-dark-50', label: 'Dark scrim 50', group: 'on-media-dark', input: 'text', advanced: true },
  { key: 'surface-on-media-dark-55', label: 'Dark scrim 55', group: 'on-media-dark', input: 'text', advanced: true },
  { key: 'surface-on-media-dark-60', label: 'Dark scrim 60', group: 'on-media-dark', input: 'text', advanced: true },
  { key: 'surface-on-media-dark-65', label: 'Dark scrim 65', group: 'on-media-dark', input: 'text', advanced: true },
  { key: 'surface-on-media-dark-70', label: 'Dark scrim 70', group: 'on-media-dark', input: 'text', advanced: true },
  { key: 'surface-on-media-dark-80', label: 'Dark scrim 80', group: 'on-media-dark', input: 'text', advanced: true },
  { key: 'chart-active', label: 'Chart active', group: 'charts', input: 'color', advanced: true },
  { key: 'chart-charges', label: 'Chart charges', group: 'charts', input: 'color', advanced: true },
  { key: 'duration-fast', label: 'Duration fast', group: 'motion', input: 'number', unit: 'ms', advanced: true },
  { key: 'duration-base', label: 'Duration base', group: 'motion', input: 'number', unit: 'ms', advanced: true },
  { key: 'duration-slow', label: 'Duration slow', group: 'motion', input: 'number', unit: 'ms', advanced: true },
  { key: 'ease-standard', label: 'Ease standard', group: 'motion', input: 'text', advanced: true },
  { key: 'ease-enter', label: 'Ease enter', group: 'motion', input: 'text', advanced: true },
  { key: 'ease-exit', label: 'Ease exit', group: 'motion', input: 'text', advanced: true },
  { key: 'blur-overlay', label: 'Blur overlay', group: 'motion', input: 'number', unit: 'px', advanced: true },
  { key: 'opacity-muted', label: 'Opacity muted', group: 'opacity', input: 'number', advanced: true },
  { key: 'opacity-disabled', label: 'Opacity disabled', group: 'opacity', input: 'number', advanced: true },
  { key: 'z-header', label: 'Z header', group: 'z-index', input: 'number', advanced: true },
  { key: 'z-popover', label: 'Z popover', group: 'z-index', input: 'number', advanced: true },
  { key: 'z-modal', label: 'Z modal', group: 'z-index', input: 'number', advanced: true },
  { key: 'z-toast', label: 'Z toast', group: 'z-index', input: 'number', advanced: true },
  { key: 'border-width', label: 'Border width', group: 'borders-advanced', input: 'number', unit: 'px', advanced: true },
  { key: 'border-strong', label: 'Border strong', group: 'borders-advanced', input: 'number', unit: 'px', advanced: true },
  { key: 'ring-width', label: 'Ring width', group: 'borders-advanced', input: 'number', unit: 'px', advanced: true },
  { key: 'ring-offset', label: 'Ring offset', group: 'borders-advanced', input: 'number', unit: 'px', advanced: true },
  { key: 'space-1', label: 'Space 1', group: 'spacing-scale', input: 'number', unit: 'px', advanced: true },
  { key: 'space-2', label: 'Space 2', group: 'spacing-scale', input: 'number', unit: 'px', advanced: true },
  { key: 'space-3', label: 'Space 3', group: 'spacing-scale', input: 'number', unit: 'px', advanced: true },
  { key: 'space-4', label: 'Space 4', group: 'spacing-scale', input: 'number', unit: 'px', advanced: true },
  { key: 'space-5', label: 'Space 5', group: 'spacing-scale', input: 'number', unit: 'px', advanced: true },
  { key: 'space-6', label: 'Space 6', group: 'spacing-scale', input: 'number', unit: 'px', advanced: true },
  { key: 'space-7', label: 'Space 7', group: 'spacing-scale', input: 'number', unit: 'px', advanced: true },
  { key: 'space-8', label: 'Space 8', group: 'spacing-scale', input: 'number', unit: 'px', advanced: true },
  { key: 'stack-gap-sm', label: 'Stack gap sm', group: 'spacing-scale', input: 'number', unit: 'px', advanced: true },
  { key: 'stack-gap-lg', label: 'Stack gap lg', group: 'spacing-scale', input: 'number', unit: 'px', advanced: true },
  { key: 'stack-gap-xl', label: 'Stack gap xl', group: 'spacing-scale', input: 'number', unit: 'px', advanced: true },
  { key: 'grid-gap-sm', label: 'Grid gap sm', group: 'spacing-scale', input: 'number', unit: 'px', advanced: true },
  { key: 'grid-gap-lg', label: 'Grid gap lg', group: 'spacing-scale', input: 'number', unit: 'px', advanced: true },
  { key: 'grid-gap-xl', label: 'Grid gap xl', group: 'spacing-scale', input: 'number', unit: 'px', advanced: true },
  { key: 'container-max', label: 'Container max', group: 'spacing-scale', input: 'number', unit: 'px', advanced: true },
  { key: 'content-max', label: 'Content max', group: 'spacing-scale', input: 'number', unit: 'px', advanced: true },
  { key: 'page-padding-x', label: 'Page padding X', group: 'spacing-scale', input: 'number', unit: 'px', advanced: true },
  { key: 'text-xs', label: 'Text XS', group: 'typography-scale', input: 'number', unit: 'px', advanced: true },
  { key: 'leading-xs', label: 'Leading XS', group: 'typography-scale', input: 'number', unit: 'px', advanced: true },
  { key: 'text-sm', label: 'Text SM', group: 'typography-scale', input: 'number', unit: 'px', advanced: true },
  { key: 'leading-sm', label: 'Leading SM', group: 'typography-scale', input: 'number', unit: 'px', advanced: true },
  { key: 'text-base', label: 'Text base', group: 'typography-scale', input: 'number', unit: 'px', advanced: true },
  { key: 'leading-base', label: 'Leading base', group: 'typography-scale', input: 'number', unit: 'px', advanced: true },
  { key: 'text-lg', label: 'Text LG', group: 'typography-scale', input: 'number', unit: 'px', advanced: true },
  { key: 'leading-lg', label: 'Leading LG', group: 'typography-scale', input: 'number', unit: 'px', advanced: true },
  { key: 'text-xl', label: 'Text XL', group: 'typography-scale', input: 'number', unit: 'px', advanced: true },
  { key: 'leading-xl', label: 'Leading XL', group: 'typography-scale', input: 'number', unit: 'px', advanced: true },
  { key: 'engine-google-veo-bg', label: 'Google Veo bg', group: 'engines', input: 'color', advanced: true },
  { key: 'engine-google-veo-ink', label: 'Google Veo ink', group: 'engines', input: 'color', advanced: true },
  { key: 'engine-openai-bg', label: 'OpenAI bg', group: 'engines', input: 'color', advanced: true },
  { key: 'engine-openai-ink', label: 'OpenAI ink', group: 'engines', input: 'color', advanced: true },
  { key: 'engine-pika-bg', label: 'Pika bg', group: 'engines', input: 'color', advanced: true },
  { key: 'engine-pika-ink', label: 'Pika ink', group: 'engines', input: 'color', advanced: true },
  { key: 'engine-minimax-bg', label: 'Minimax bg', group: 'engines', input: 'color', advanced: true },
  { key: 'engine-minimax-ink', label: 'Minimax ink', group: 'engines', input: 'color', advanced: true },
  { key: 'engine-kling-bg', label: 'Kling bg', group: 'engines', input: 'color', advanced: true },
  { key: 'engine-kling-ink', label: 'Kling ink', group: 'engines', input: 'color', advanced: true },
  { key: 'engine-wan-bg', label: 'WAN bg', group: 'engines', input: 'color', advanced: true },
  { key: 'engine-wan-ink', label: 'WAN ink', group: 'engines', input: 'color', advanced: true },
  { key: 'engine-luma-bg', label: 'Luma bg', group: 'engines', input: 'color', advanced: true },
  { key: 'engine-luma-ink', label: 'Luma ink', group: 'engines', input: 'color', advanced: true },
  { key: 'engine-runway-bg', label: 'Runway bg', group: 'engines', input: 'color', advanced: true },
  { key: 'engine-runway-ink', label: 'Runway ink', group: 'engines', input: 'color', advanced: true },
  { key: 'engine-lightricks-bg', label: 'Lightricks bg', group: 'engines', input: 'color', advanced: true },
  { key: 'engine-lightricks-ink', label: 'Lightricks ink', group: 'engines', input: 'color', advanced: true },
  { key: 'engine-google-bg', label: 'Google bg', group: 'engines', input: 'color', advanced: true },
  { key: 'engine-google-ink', label: 'Google ink', group: 'engines', input: 'color', advanced: true },
];

const TOKEN_DEF_MAP = new Map(THEME_TOKEN_DEFS.map((token) => [token.key, token]));
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const NUMBER_RE = /^\d+(\.\d+)?$/;
const SAFE_TEXT_RE = /^[a-zA-Z0-9#(),.%\s\-]+$/;

export const THEME_TOKEN_KEYS = new Set(THEME_TOKEN_DEFS.map((token) => token.key));

export function normalizeThemeTokens(input: unknown): ThemeTokensSetting {
  if (!input || typeof input !== 'object') {
    return { light: {}, dark: {} };
  }
  const payload = input as { light?: unknown; dark?: unknown };
  return {
    light: normalizeTokenMap(payload.light),
    dark: normalizeTokenMap(payload.dark),
  };
}

export function buildThemeTokensStyle(setting: ThemeTokensSetting): string {
  const lightVars = buildVarBlock(setting.light);
  const darkVars = buildVarBlock(setting.dark);
  const blocks: string[] = [];

  if (lightVars.length) {
    blocks.push(`:root {\n${lightVars.join('\n')}\n}`);
  }
  if (darkVars.length) {
    blocks.push(`[data-theme="dark"] {\n${darkVars.join('\n')}\n}`);
  }
  return blocks.join('\n\n');
}

export function validateThemeTokens(setting: ThemeTokensSetting): ThemeTokenValidationError[] {
  const errors: ThemeTokenValidationError[] = [];
  validateTokenMap('light', setting.light, errors);
  validateTokenMap('dark', setting.dark, errors);
  return errors;
}

function normalizeTokenMap(input: unknown): ThemeTokenValues {
  if (!input || typeof input !== 'object') {
    return {};
  }
  const record = input as Record<string, unknown>;
  const output: ThemeTokenValues = {};
  for (const [key, value] of Object.entries(record)) {
    if (!THEME_TOKEN_KEYS.has(key)) continue;
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    output[key] = trimmed;
  }
  return output;
}

function validateTokenMap(
  mode: ThemeTokenValidationError['mode'],
  tokens: ThemeTokenValues,
  errors: ThemeTokenValidationError[]
) {
  for (const [key, value] of Object.entries(tokens)) {
    const def = TOKEN_DEF_MAP.get(key);
    if (!def) continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (def.input === 'color') {
      if (!HEX_COLOR_RE.test(trimmed)) {
        errors.push({ mode, key, value: trimmed, reason: 'hex' });
      }
      continue;
    }
    if (def.input === 'number') {
      if (!isNumberValue(trimmed, def.unit)) {
        errors.push({ mode, key, value: trimmed, reason: def.unit ? `number:${def.unit}` : 'number' });
      }
      continue;
    }
    if (!SAFE_TEXT_RE.test(trimmed)) {
      errors.push({ mode, key, value: trimmed, reason: 'text' });
    }
  }
}

function isNumberValue(value: string, unit?: string) {
  if (NUMBER_RE.test(value)) return true;
  if (!unit) return false;
  if (value.endsWith(unit)) {
    const raw = value.slice(0, -unit.length);
    return NUMBER_RE.test(raw);
  }
  return false;
}

function buildVarBlock(values: ThemeTokenValues): string[] {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(values)) {
    if (!THEME_TOKEN_KEYS.has(key)) continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    lines.push(`  --${key}: ${trimmed};`);
  }
  return lines;
}
