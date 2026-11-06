'use client';

import { useState } from 'react';
import type { ImageGenerationMode } from '@/types/image-generation';

/** Composer values; schema defaults and persistence retain their dedicated owners. */
export function useImageComposerValues(initialEngineId: string) {
  const [engineId, setEngineId] = useState(() => initialEngineId);
  const [mode, setMode] = useState<ImageGenerationMode>('t2i');
  const [prompt, setPrompt] = useState('');
  const [numImages, setNumImages] = useState(1);
  const [aspectRatio, setAspectRatio] = useState<string | null>(null);
  const [resolution, setResolution] = useState<string | null>(null);
  const [customImageWidth, setCustomImageWidth] = useState<string>('');
  const [customImageHeight, setCustomImageHeight] = useState<string>('');
  const [seed, setSeed] = useState<string>('');
  const [outputFormat, setOutputFormat] = useState<string | null>(null);
  const [outputCompression, setOutputCompression] = useState<number | null>(null);
  const [quality, setQuality] = useState<string | null>(null);
  const [background, setBackground] = useState<string | null>(null);
  const [style, setStyle] = useState<string | null>(null);
  const [maskUrl, setMaskUrl] = useState<string>('');
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  const [thinkingLevel, setThinkingLevel] = useState<string | null>(null);
  const [complexity, setComplexity] = useState<string | null>(null);
  const [limitGenerations, setLimitGenerations] = useState(false);
  const [watermark, setWatermark] = useState(false);
  return {
    engineId, setEngineId, mode, setMode, prompt, setPrompt,
    numImages, setNumImages, aspectRatio, setAspectRatio, resolution, setResolution,
    customImageWidth, setCustomImageWidth, customImageHeight, setCustomImageHeight, seed, setSeed,
    outputFormat, setOutputFormat, outputCompression, setOutputCompression, quality, setQuality, background, setBackground,
    style, setStyle, maskUrl, setMaskUrl, enableWebSearch, setEnableWebSearch,
    thinkingLevel, setThinkingLevel, complexity, setComplexity, limitGenerations, setLimitGenerations,
    watermark, setWatermark,
  };
}
