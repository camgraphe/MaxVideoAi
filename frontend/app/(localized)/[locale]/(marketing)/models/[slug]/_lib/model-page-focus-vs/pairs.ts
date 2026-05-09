import { CREATIVE_FOCUS_VS_PAIRS } from './creative-pairs';
import { FOUNDATION_FOCUS_VS_PAIRS } from './foundation-pairs';
import { KLING_FOCUS_VS_PAIRS } from './kling-pairs';
import { SEEDANCE_FOCUS_VS_PAIRS } from './seedance-pairs';
import { SPECIALIZED_FOCUS_VS_PAIRS } from './specialized-pairs';
import type { FocusVsPair } from './types';

export const FOCUS_VS_PAIRS: FocusVsPair[] = [
  ...FOUNDATION_FOCUS_VS_PAIRS,
  ...KLING_FOCUS_VS_PAIRS,
  ...SEEDANCE_FOCUS_VS_PAIRS,
  ...CREATIVE_FOCUS_VS_PAIRS,
  ...SPECIALIZED_FOCUS_VS_PAIRS,
];
