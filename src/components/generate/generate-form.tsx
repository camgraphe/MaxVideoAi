"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Download, Loader2, Share2, Sparkles, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PriceBadge } from "@/components/generate/price-badge";
import { Progress } from "@/components/ui/progress";
import { generationPresets } from "@/data/presets";
import {
  ENGINE_LABELS,
  FAL_INIT_IMAGE_REQUIRED_ENGINES,
  FAL_REF_VIDEO_REQUIRED_ENGINES,
  formatModelSummary,
  getModelSpecByEngine,
} from "@/data/models";
import { useToast } from "@/hooks/use-toast";
import { estimateCost } from "@/lib/pricing";
import type { EstimateCostOutput } from "@/types/pricing";
import { z } from "zod";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type { SerializedJob } from "@/db/repositories/jobs-repo";
import { normalizeDurationSeconds } from "@/lib/models/normalization";

const ratioOptions = ["9:16", "16:9", "1:1", "21:9"] as const;
const FLOAT_TOLERANCE = 1e-6;

const urlField = z
  .string()
  .url()
  .optional()
  .or(z.literal(""))
  .transform((value) => (value ? value : undefined));

const optionalTextField = z
  .string()
  .max(2000)
  .optional()
  .or(z.literal(""))
  .transform((value) => (value ? value : undefined));

const formSchema = z.object({
  presetId: z.string(),
  prompt: z.string().min(10, "Describe your scene in a few sentences."),
  provider: z.literal("fal").default("fal"),
  engine: z.string(),
  ratio: z.enum(ratioOptions),
  durationSeconds: z.coerce.number().min(4).max(16),
  withAudio: z.boolean().default(true),
  quantity: z.coerce.number().min(1).max(4).default(1),
  seed: z.coerce.number().optional(),
  inputImageUrl: urlField,
  maskUrl: urlField,
  referenceImageUrl: urlField,
  referenceVideoUrl: urlField,
  negativePrompt: optionalTextField,
  fps: z.coerce.number().min(1).max(60).optional(),
  motionStrength: z.coerce.number().min(0).max(1).optional(),
  cfgScale: z.coerce.number().min(0).max(30).optional(),
  steps: z.coerce.number().min(1).max(120).optional(),
  watermark: z.boolean().optional(),
  upscaling: z.boolean().optional(),
});

export type GenerateFormValues = z.infer<typeof formSchema>;

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function buildDefaultValuesFromPreset(preset: (typeof generationPresets)[number]): GenerateFormValues {
  const model = getModelSpecByEngine(preset.provider, preset.engine);
  return {
    presetId: preset.id,
    prompt: "",
    provider: "fal",
    engine: preset.engine,
    ratio: preset.ratio,
    durationSeconds: preset.durationSeconds,
    withAudio: preset.withAudio,
    quantity: 1,
    seed: preset.seed,
    inputImageUrl: undefined,
    maskUrl: undefined,
    referenceImageUrl: undefined,
    referenceVideoUrl: undefined,
    negativePrompt: preset.negativePrompt,
    fps: preset.advancedDefaults?.fps ?? model?.defaults.fps,
    motionStrength: preset.advancedDefaults?.motionStrength ?? model?.defaults.motionStrength,
    cfgScale: preset.advancedDefaults?.cfgScale ?? model?.defaults.cfgScale,
    steps: preset.advancedDefaults?.steps ?? model?.defaults.steps,
    watermark:
      preset.advancedDefaults?.watermark ?? (model?.supports.watermarkToggle ? true : undefined),
    upscaling: preset.advancedDefaults?.upscaling ?? (model?.supports.upscaling ? false : undefined),
  } satisfies GenerateFormValues;
}

export function GenerateForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cost, setCost] = useState<EstimateCostOutput | undefined>();
  type LaunchJobPayload = {
    provider: string;
    engine: string;
    modelId?: string;
    prompt: string;
    ratio: "9:16" | "16:9";
    durationSeconds: number;
    withAudio: boolean;
    seed?: number;
    presetId: string;
    negativePrompt?: string;
    quantity: number;
    metadata: Record<string, unknown>;
  };

  type ConfirmState = {
    serverCostCents: number;
    budgetCents: number;
    suggestion?: { engine?: string; estimatedCents?: number };
    payload: LaunchJobPayload;
  } | undefined;

  const [confirmData, setConfirmData] = useState<ConfirmState>(undefined);
  const [activeJob, setActiveJob] = useState<SerializedJob | null>(null);
  const refreshedJobIdRef = React.useRef<string | null>(null);

  const defaultPreset = generationPresets[0];

  const defaultValues = React.useMemo(() => buildDefaultValuesFromPreset(defaultPreset), [defaultPreset]);

  const form = useForm<GenerateFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const provider = "fal" as const;
  const engine = form.watch("engine");
  const durationSeconds = form.watch("durationSeconds");
  const withAudio = form.watch("withAudio");
  const quantity = form.watch("quantity");
  const selectedPresetId = form.watch("presetId");
  const ratio = form.watch("ratio");
  const fps = form.watch("fps");
  const motionStrength = form.watch("motionStrength");
  const cfgScale = form.watch("cfgScale");
  const steps = form.watch("steps");
  const watermark = form.watch("watermark");
  const upscaling = form.watch("upscaling");
  const inputImageUrl = form.watch("inputImageUrl");
  const referenceVideoUrl = form.watch("referenceVideoUrl");
  const modelSpec = React.useMemo(() => {
    if (provider !== "fal") return undefined;
    return getModelSpecByEngine("fal", engine);
  }, [provider, engine]);

  const initImageRequired = React.useMemo(
    () => (modelSpec ? FAL_INIT_IMAGE_REQUIRED_ENGINES.has(modelSpec.id) : false),
    [modelSpec],
  );
  const refVideoRequired = React.useMemo(
    () => (modelSpec ? FAL_REF_VIDEO_REQUIRED_ENGINES.has(modelSpec.id) : false),
    [modelSpec],
  );

  const missingInitImage = initImageRequired && !inputImageUrl;
  const missingReferenceVideo = refVideoRequired && !referenceVideoUrl;
  const ratioIsValid = !modelSpec || modelSpec.constraints.ratios.includes(ratio);
  const durationIsValid = !modelSpec
    ? true
    : Math.abs(normalizeDurationSeconds(durationSeconds, modelSpec) - durationSeconds) <= FLOAT_TOLERANCE;

  const configIssues = React.useMemo(() => {
    const issues: string[] = [];
    if (missingInitImage) {
      issues.push("Provide an init image");
    }
    if (missingReferenceVideo) {
      issues.push("Attach a reference video");
    }
    if (!ratioIsValid) {
      issues.push("Pick a supported ratio");
    }
    if (!durationIsValid) {
      issues.push("Adjust the duration to the model range");
    }
    return issues;
  }, [missingInitImage, missingReferenceVideo, ratioIsValid, durationIsValid]);

  const isConfigValid = configIssues.length === 0;

  const durationRange = modelSpec?.constraints.durationSeconds;
  const fpsRange = modelSpec?.constraints.fps;
  const motionRange = modelSpec?.constraints.motionStrength;
  const cfgRange = modelSpec?.constraints.cfgScale;
  const stepsRange = modelSpec?.constraints.steps;

  const [uploadingFields, setUploadingFields] = React.useState<Record<string, boolean>>({});
  const fileInputs = {
    inputImageUrl: useRef<HTMLInputElement | null>(null),
    maskUrl: useRef<HTMLInputElement | null>(null),
    referenceImageUrl: useRef<HTMLInputElement | null>(null),
    referenceVideoUrl: useRef<HTMLInputElement | null>(null),
  };

  const isUploading = React.useCallback(
    (field: keyof typeof uploadingFields) => Boolean(uploadingFields[field]),
    [uploadingFields],
  );

  const uploadAsset = React.useCallback(async (file: File) => {
    const presignResponse = await fetch("/api/uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, contentType: file.type || "application/octet-stream" }),
    });

    if (!presignResponse.ok) {
      const payload = await presignResponse.json().catch(() => undefined);
      throw new Error(payload?.error ?? "Unable to create upload session");
    }

    const presign = (await presignResponse.json()) as {
      uploadUrl: string;
      fields: Record<string, string>;
      fileUrl: string;
    };

    const uploadForm = new FormData();
    Object.entries(presign.fields).forEach(([key, value]) => {
      uploadForm.append(key, value);
    });
    uploadForm.append("file", file);

    const uploadResponse = await fetch(presign.uploadUrl, {
      method: "POST",
      body: uploadForm,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Upload failed (${uploadResponse.status}): ${errorText}`);
    }

    return presign.fileUrl;
  }, []);

  const handleFileSelection = React.useCallback(
    async (
      field:
        | "inputImageUrl"
        | "maskUrl"
        | "referenceImageUrl"
        | "referenceVideoUrl",
      files: FileList | null,
    ) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      setUploadingFields((prev) => ({ ...prev, [field]: true }));
      try {
        const uploadedUrl = await uploadAsset(file);
        form.setValue(field, uploadedUrl, { shouldDirty: true });
        toast({
          title: "Asset uploaded",
          description: file.name,
        });
      } catch (error) {
        console.error(error);
        toast({
          title: "Upload failed",
          description: error instanceof Error ? error.message : "Unable to upload the selected file",
          variant: "destructive",
        });
      } finally {
        setUploadingFields((prev) => ({ ...prev, [field]: false }));
      }
    },
    [form, toast, uploadAsset],
  );

  React.useEffect(() => {
    if (!modelSpec) return;

    if (!modelSpec.constraints.ratios.includes(ratio)) {
      form.setValue("ratio", modelSpec.constraints.ratios[0]);
    }

    const durationRange = modelSpec.constraints.durationSeconds;
    if (durationRange) {
      const fallback = durationRange.default ?? durationRange.min;
      const safeDuration = clampNumber(
        Number.isFinite(durationSeconds) ? Number(durationSeconds) : fallback,
        durationRange.min,
        durationRange.max,
      );
      if (safeDuration !== durationSeconds) {
        form.setValue("durationSeconds", safeDuration);
      }
    } else if (modelSpec.contentType === "image" && durationSeconds !== 4) {
      form.setValue("durationSeconds", 4);
    }

    if (!modelSpec.supports.audio && withAudio) {
      form.setValue("withAudio", false);
    }

    const fpsRange = modelSpec.constraints.fps;
    if (fpsRange) {
      const fallback = fpsRange.default ?? fpsRange.min;
      const safeFps = clampNumber(fps ?? fallback, fpsRange.min, fpsRange.max);
      if (safeFps !== fps) {
        form.setValue("fps", safeFps);
      }
    } else if (typeof fps !== "undefined") {
      form.setValue("fps", undefined);
    }

    const motionRange = modelSpec.constraints.motionStrength;
    if (motionRange) {
      const fallback = motionRange.default ?? motionRange.min;
      const safeMotion = clampNumber(motionStrength ?? fallback, motionRange.min, motionRange.max);
      if (safeMotion !== motionStrength) {
        form.setValue("motionStrength", safeMotion);
      }
    } else if (typeof motionStrength !== "undefined") {
      form.setValue("motionStrength", undefined);
    }

    const cfgRange = modelSpec.constraints.cfgScale;
    if (cfgRange) {
      const fallback = cfgRange.default ?? cfgRange.min;
      const safeCfg = clampNumber(cfgScale ?? fallback, cfgRange.min, cfgRange.max);
      if (safeCfg !== cfgScale) {
        form.setValue("cfgScale", safeCfg);
      }
    } else if (typeof cfgScale !== "undefined") {
      form.setValue("cfgScale", undefined);
    }

    const stepsRange = modelSpec.constraints.steps;
    if (stepsRange) {
      const fallback = stepsRange.default ?? stepsRange.min;
      const safeSteps = clampNumber(steps ?? fallback, stepsRange.min, stepsRange.max);
      if (safeSteps !== steps) {
        form.setValue("steps", safeSteps);
      }
    } else if (typeof steps !== "undefined") {
      form.setValue("steps", undefined);
    }

    if (!modelSpec.supports.watermarkToggle && typeof watermark !== "undefined") {
      form.setValue("watermark", undefined);
    } else if (modelSpec.supports.watermarkToggle && typeof watermark === "undefined") {
      form.setValue("watermark", true);
    }

    if (!modelSpec.supports.upscaling && typeof upscaling !== "undefined") {
      form.setValue("upscaling", undefined);
    } else if (modelSpec.supports.upscaling && typeof upscaling === "undefined") {
      form.setValue("upscaling", false);
    }
  }, [
    modelSpec,
    ratio,
    durationSeconds,
    withAudio,
    fps,
    motionStrength,
    cfgScale,
    steps,
    watermark,
    upscaling,
    form,
  ]);

  React.useEffect(() => {
    try {
      const nextCost = estimateCost({
        provider,
        engine,
        durationSeconds: Number(durationSeconds) || 0,
        withAudio,
        quantity: Number(quantity) || 1,
      });
      setCost(nextCost);
    } catch (error) {
      console.error(error);
      setCost(undefined);
    }
  }, [provider, engine, durationSeconds, withAudio, quantity]);

  React.useEffect(() => {
    if (!activeJob) return;
    if (activeJob.status === "completed" || activeJob.status === "failed") {
      return;
    }

    let cancelled = false;
    let intervalId: ReturnType<typeof window.setInterval> | null = null;

    const fetchLatest = async () => {
      try {
        const response = await fetch(`/api/jobs/${activeJob.id}`, { cache: "no-store" });
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as { job: SerializedJob };
        if (cancelled) {
          return;
        }
        if (data.job) {
          setActiveJob(data.job);
          if (data.job.status === "completed" || data.job.status === "failed") {
            if (intervalId) window.clearInterval(intervalId);
          }
        }
      } catch (error) {
        console.error(error);
      }
    };

    fetchLatest();
    intervalId = window.setInterval(fetchLatest, 4000);

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [activeJob]);

  React.useEffect(() => {
    if (!activeJob) return;
    if (activeJob.status !== "completed") return;
    if (!activeJob.outputUrl) return;
    if (refreshedJobIdRef.current === activeJob.id) return;

    refreshedJobIdRef.current = activeJob.id;
    router.refresh();
  }, [activeJob, router]);

  const handleShare = React.useCallback(
    async (job: SerializedJob) => {
      if (typeof window === "undefined") return;
      if (!job.outputUrl) {
        toast({
          title: "Preview not ready",
          description: "The clip will appear here as soon as the render finishes.",
          variant: "destructive",
        });
        return;
      }

      const shareUrl = job.outputUrl;
      try {
        if (navigator.share) {
          await navigator.share({ title: "Video render", url: shareUrl });
          toast({
            title: "Share dialog opened",
            description: "Use your device share menu to send the clip.",
          });
          return;
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        console.warn("Share failed, falling back to clipboard", error);
      }

      if (navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(shareUrl);
          toast({
            title: "Link copied",
            description: "The video URL is now in your clipboard.",
          });
          return;
        } catch (error) {
          console.error(error);
        }
      }

      toast({
        title: "Share unavailable",
        description: "Try again later or copy the URL manually.",
        variant: "destructive",
      });
    },
    [toast],
  );

  const handlePresetChange = (presetId: string) => {
    const preset = generationPresets.find((item) => item.id === presetId);
    if (!preset) return;

    const previousPrompt = form.getValues("prompt");
    const previousQuantity = form.getValues("quantity");

    const defaults = buildDefaultValuesFromPreset(preset);
    form.reset(
      {
        ...defaults,
        prompt: previousPrompt,
        quantity: previousQuantity,
      },
      { keepDefaultValues: false },
    );
  };

  const engineOptions = React.useMemo(
    () =>
      Object.entries(ENGINE_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    [],
  );

  const onSubmit = async (values: GenerateFormValues) => {
    if (!isConfigValid) {
      toast({
        title: "Configuration incomplete",
        description: configIssues.join(" · ") || "Fill the required inputs to continue.",
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);
    setActiveJob(null);
    refreshedJobIdRef.current = null;
    try {
      const specForSubmission =
        values.provider === "fal" ? getModelSpecByEngine("fal", values.engine) : undefined;
      const metadata: Record<string, unknown> = {};

      if (values.inputImageUrl) metadata.inputImageUrl = values.inputImageUrl;
      if (values.maskUrl) metadata.maskUrl = values.maskUrl;
      if (values.referenceImageUrl) metadata.referenceImageUrl = values.referenceImageUrl;
      if (values.referenceVideoUrl) metadata.referenceVideoUrl = values.referenceVideoUrl;
      if (values.negativePrompt) metadata.negativePrompt = values.negativePrompt;
      if (typeof values.fps !== "undefined") metadata.fps = values.fps;
      if (typeof values.motionStrength !== "undefined") metadata.motionStrength = values.motionStrength;
      if (typeof values.cfgScale !== "undefined") metadata.cfgScale = values.cfgScale;
      if (typeof values.steps !== "undefined") metadata.steps = values.steps;
      if (typeof values.watermark !== "undefined") metadata.watermark = values.watermark;
      if (typeof values.upscaling !== "undefined") metadata.upscaling = values.upscaling;
      if (specForSubmission?.id) {
        metadata.modelId = specForSubmission.id;
      }
      if (specForSubmission) {
        metadata.modelSummary = formatModelSummary(specForSubmission);
        if (specForSubmission.defaults.resolution && metadata.resolution === undefined) {
          metadata.resolution = specForSubmission.defaults.resolution;
        }
      }

      const preset = generationPresets.find((item) => item.id === values.presetId);
      if (metadata.resolution === undefined && preset?.advancedDefaults?.resolution) {
        metadata.resolution = preset.advancedDefaults.resolution;
      }

      const body: LaunchJobPayload = {
        provider: values.provider,
        engine: values.engine,
        modelId: specForSubmission?.id,
        prompt: values.prompt,
        ratio: values.ratio,
        durationSeconds: values.durationSeconds,
        withAudio: specForSubmission?.supports.audio ? values.withAudio : false,
        seed: values.seed,
        presetId: values.presetId,
        negativePrompt: values.negativePrompt,
        quantity: values.quantity,
        metadata,
      };

      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = await response.json();
      if (response.status === 409 && payload?.code === "BUDGET_EXCEEDED") {
        setConfirmData({
          serverCostCents: payload.serverCostCents,
          budgetCents: payload.budgetCents,
          suggestion: payload.suggestion,
          payload: body,
        });
        return;
      }

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to create the job");
      }

      if (payload?.job) {
        setActiveJob(payload.job as SerializedJob);
      }

      toast({
        title: "Job launched",
        description: "Rendering has started. The preview will update automatically.",
      });
    } catch (error) {
      toast({
        title: "Something went wrong",
        description: error instanceof Error ? error.message : "Unexpected error while creating the job.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmBudgetAndSubmit = async () => {
    if (!confirmData) return;
    setIsSubmitting(true);
    setActiveJob(null);
    refreshedJobIdRef.current = null;
    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...confirmData.payload, confirm: true }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to create the job");
      }
      setConfirmData(undefined);
      if (payload?.job) {
        setActiveJob(payload.job as SerializedJob);
      }
      toast({
        title: "Job launched",
        description: "Rendering has started. The preview will update automatically.",
      });
    } catch (error) {
      setConfirmData(undefined);
      toast({
        title: "Something went wrong",
        description: error instanceof Error ? error.message : "Unexpected error while confirming the job.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full border border-black/10 bg-zinc-50 backdrop-blur dark:border-white/10 dark:bg-[#080d16]">
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <PriceBadge cost={cost} disabled={isSubmitting} />
              <Button
                type="submit"
                size="lg"
                className="gap-2 self-start sm:self-auto"
                disabled={isSubmitting || !isConfigValid}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending to render farm
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate clip
                  </>
                )}
              </Button>
              {!isConfigValid ? (
                <p className="text-xs font-medium text-rose-500">
                  {configIssues[0] ? `${configIssues[0]}.` : "Fill the required inputs to continue."}
                </p>
              ) : null}
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
              <aside className="relative isolate w-full overflow-hidden rounded-[24px] border border-black/10 bg-white/90 p-4 text-foreground shadow-[0_30px_90px_-60px_rgba(17,24,39,0.2)] dark:border-white/10 dark:bg-[#0f1729]">
                <div className="pointer-events-none absolute inset-0 rounded-[24px] border border-black/5 bg-gradient-to-b from-white/40 via-white/20 to-transparent opacity-70 dark:border-white/[0.08] dark:from-white/[0.04] dark:via-white/[0.01] dark:to-transparent" />
                <div className="relative flex h-full flex-col gap-6">
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-4 w-4 text-primary dark:text-primary/80" />
                    <span className="text-sm font-semibold uppercase tracking-[0.32em] text-muted-foreground">
                      Toolkit
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground dark:text-slate-300">
                    Ajustez rapidement moteur, ratio, durée et audio. Toutes les options restent visibles, sans redimensionnement surprise.
                  </p>
                  <div className="flex flex-col gap-5 text-xs text-muted-foreground dark:text-slate-200">
                    <FormField
                      control={form.control}
                      name="engine"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
                            Engine
                          </FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="w-full rounded-2xl border border-black/10 bg-white/90 px-3 py-2 text-left text-sm font-medium text-foreground shadow-sm focus-visible:border-primary focus-visible:ring-primary/30 dark:border-white/10 dark:bg-[#162130] dark:text-slate-100">
                                <SelectValue placeholder="Select an engine" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="max-h-72 bg-white dark:bg-[#0b1321]">
                              {engineOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="ratio"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
                            Ratio
                          </FormLabel>
                          <div className="flex flex-wrap gap-2">
                            {(modelSpec?.constraints.ratios ?? ratioOptions).map((value) => {
                              const isActive = field.value === value;
                              return (
                                <Button
                                  key={value}
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className={cn(
                                    "rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors duration-200",
                                    isActive
                                      ? "border-primary bg-primary text-primary-foreground shadow"
                                      : "hover:border-primary/60 hover:bg-primary/10 hover:text-foreground",
                                  )}
                                  onClick={() => field.onChange(value)}
                                >
                                  {value}
                                </Button>
                              );
                            })}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid gap-3 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="durationSeconds"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <FormLabel className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
                              Duration
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={durationRange?.min ?? 4}
                                max={durationRange?.max ?? 16}
                                step={durationRange?.step ?? 1}
                                value={field.value}
                                onChange={(event) => field.onChange(event.target.valueAsNumber)}
                                className="w-full rounded-2xl border border-black/10 bg-white/85 px-3 py-2 text-center text-sm font-semibold text-foreground shadow-inner placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-primary/30 dark:border-white/10 dark:bg-white/[0.05] dark:text-white"
                              />
                            </FormControl>
                            <FormDescription className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground/70">
                              {durationRange ? `${durationRange.min}-${durationRange.max}s` : "4-16s"}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="quantity"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <FormLabel className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
                              Variants
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={1}
                                max={4}
                                value={field.value}
                                onChange={(event) => field.onChange(event.target.valueAsNumber)}
                                className="w-full rounded-2xl border border-black/10 bg-white/85 px-3 py-2 text-center text-sm font-semibold text-foreground shadow-inner placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-primary/30 dark:border-white/10 dark:bg-white/[0.05] dark:text-white"
                              />
                            </FormControl>
                            <FormDescription className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground/70">
                              Up to 4 variants
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="withAudio"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/85 px-4 py-3 dark:border-white/10 dark:bg-white/[0.05]">
                          <div className="space-y-1">
                            <FormLabel className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
                              Audio bed
                            </FormLabel>
                            <FormDescription className="text-[11px] text-muted-foreground/70">
                              {modelSpec?.supports.audio ? "Generate soundtrack" : "Unavailable"}
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={modelSpec?.supports.audio ? field.value : false}
                              onCheckedChange={field.onChange}
                              disabled={!modelSpec?.supports.audio}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </aside>
              <div className="space-y-6">
                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="flex h-full flex-col overflow-hidden rounded-[24px] border border-black/10 bg-white/90 p-4 shadow-[0_30px_90px_-70px_rgba(17,24,39,0.25)] backdrop-blur dark:border-white/10 dark:bg-[#101827]">
                    <FormField
                      control={form.control}
                      name="prompt"
                      render={({ field }) => (
                        <FormItem className="flex h-full flex-col">
                          <FormLabel className="text-sm font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                            Prompt
                          </FormLabel>
                          <FormControl className="flex-1">
                            <Textarea
                              placeholder="Describe the scene, mood, camera moves, lighting cues, brand beats..."
                              className="h-full min-h-[200px] flex-1 border border-transparent bg-white text-sm text-foreground shadow-inner outline-none transition focus:border-primary/50 focus:ring-0 dark:bg-[#0b1321] dark:text-slate-100 md:min-h-[230px] xl:min-h-[300px]"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription className="text-[11px] text-muted-foreground/70">
                            Décrivez l&apos;ambiance, la caméra et les détails clés. Évitez les artefacts via le negative prompt.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <VideoPreviewPanel job={activeJob} isSubmitting={isSubmitting} onShare={handleShare} />
                </div>

                <section className="relative overflow-hidden rounded-[24px] border border-black/10 bg-white/90 p-4 shadow-[0_30px_90px_-70px_rgba(79,70,229,0.4)] backdrop-blur dark:border-white/10 dark:bg-[#101827]">
                  <div className="mb-4 space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.32em] text-muted-foreground">
                      Presets
                    </span>
                    <p className="text-xs text-muted-foreground/80">
                      Start from a tuned profile, then refine with the toolkit.
                    </p>
                  </div>
                  <ScrollArea className="w-full overflow-hidden">
                    <div className="flex gap-3 pb-3 pr-3 snap-x snap-mandatory">
                      {generationPresets.map((preset) => {
                        const presetSpec = getModelSpecByEngine(preset.provider, preset.engine);
                        const isActive = selectedPresetId === preset.id;
                        return (
                          <button
                            type="button"
                            key={preset.id}
                            onClick={() => handlePresetChange(preset.id)}
                            className={cn(
                              "group relative flex min-w-[170px] max-w-[60vw] snap-start flex-col gap-2 rounded-[16px] border border-black/15 bg-white p-3 text-left shadow-[0_22px_60px_-55px_rgba(79,70,229,0.35)] transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_28px_80px_-60px_rgba(79,70,229,0.5)] dark:border-white/10 dark:bg-[#162130]",
                              isActive && "border-primary/70 shadow-[0_36px_90px_-60px_rgba(124,58,237,0.55)]",
                            )}
                          >
                            <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground dark:text-slate-300">
                              <span>{preset.provider.toUpperCase()}</span>
                              <span>
                                {preset.ratio} • {preset.durationSeconds}s
                              </span>
                            </div>
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-foreground dark:text-white">{preset.name}</p>
                              <p className="text-[11px] text-muted-foreground/80 dark:text-slate-300">{preset.description}</p>
                              {presetSpec ? (
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70 dark:text-slate-400">
                                  {presetSpec.constraints.ratios.join(" / ")} ·{" "}
                                  {presetSpec.constraints.durationSeconds
                                    ? `${presetSpec.constraints.durationSeconds.min}-${presetSpec.constraints.durationSeconds.max}s`
                                    : presetSpec.constraints.resolution}
                                </p>
                              ) : null}
                            </div>
                            {isActive ? <ActiveGlow /> : null}
                          </button>
                        );
                      })}
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </section>
                {modelSpec ? (
                  <section className="relative overflow-hidden rounded-[24px] border border-black/10 bg-white/90 p-4 text-foreground shadow-[0_30px_90px_-70px_rgba(17,24,39,0.25)] backdrop-blur dark:border-white/10 dark:bg-[#101827] dark:text-slate-100">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="space-y-1">
                        <p className="text-base font-semibold tracking-wide">{modelSpec.label}</p>
                        <p className="text-sm text-muted-foreground dark:text-slate-300">{modelSpec.description}</p>
                      </div>
                      <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                        {modelSpec.contentType === "video" ? "Video" : "Image"}
                      </Badge>
                    </div>
                    <div className="mt-4 grid gap-3 text-xs text-muted-foreground md:grid-cols-2 dark:text-slate-300">
                      <div className="flex flex-wrap items-center gap-2">
                        {modelSpec.supports.imageInit ? (
                          <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] uppercase tracking-wide text-primary/90">
                            Image init
                          </span>
                        ) : null}
                        {modelSpec.supports.mask ? (
                          <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] uppercase tracking-wide text-primary/90">
                            Mask
                          </span>
                        ) : null}
                        {modelSpec.supports.refVideo ? (
                          <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] uppercase tracking-wide text-primary/90">
                            Ref video
                          </span>
                        ) : null}
                        {modelSpec.supports.audio ? (
                          <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] uppercase tracking-wide text-primary/90">
                            Audio
                          </span>
                        ) : null}
                        {modelSpec.supports.seed ? (
                          <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] uppercase tracking-wide text-primary/90">
                            Seed
                          </span>
                        ) : null}
                      </div>
                      <p className="dark:text-slate-300">
                        Ratios {modelSpec.constraints.ratios.join(" / ")}
                        {modelSpec.constraints.durationSeconds
                          ? ` • ${modelSpec.constraints.durationSeconds.min}-${modelSpec.constraints.durationSeconds.max}s`
                          : ""}
                        {" "}• {modelSpec.constraints.resolution}
                      </p>
                    </div>
                  </section>
                ) : null}
              </div>
            </div>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
              <section className="space-y-4 overflow-hidden rounded-[24px] border border-black/10 bg-white/90 p-4 shadow-[0_35px_100px_-70px_rgba(17,24,39,0.35)] backdrop-blur dark:border-white/10 dark:bg-[#101827]">
                {modelSpec?.supports.imageInit || modelSpec?.supports.imageReference || modelSpec?.supports.refVideo ? (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                      Source assets
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {modelSpec?.supports.imageInit ? (
                        <FormField
                          control={form.control}
                          name="inputImageUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2">
                                Init image
                                {initImageRequired ? (
                                  <Badge
                                    variant="outline"
                                    className="border-rose-500/60 bg-rose-500/10 text-[10px] font-semibold uppercase tracking-wide text-rose-600"
                                  >
                                    Required
                                  </Badge>
                                ) : null}
                              </FormLabel>
                              <div className="flex flex-col gap-2">
                                <input
                                  type="file"
                                  accept="image/*"
                                  ref={fileInputs.inputImageUrl}
                                  className="hidden"
                                  onChange={async (event) => {
                                    await handleFileSelection("inputImageUrl", event.target.files);
                                    event.target.value = "";
                                  }}
                                />
                                <div className="flex flex-wrap items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => fileInputs.inputImageUrl.current?.click()}
                                    disabled={isUploading("inputImageUrl") || isSubmitting}
                                  >
                                    <Upload className="mr-2 h-4 w-4" />
                                    {isUploading("inputImageUrl") ? "Uploading..." : "Upload image"}
                                  </Button>
                                  {field.value ? (
                                    <span className="truncate text-xs text-muted-foreground">
                                      {field.value.split("/").pop()}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">No file selected</span>
                                  )}
                                  {field.value ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => field.onChange(undefined)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      <span className="sr-only">Remove init image</span>
                                    </Button>
                                  ) : null}
                                </div>
                                {field.value ? (
                                  <div className="mt-2 h-28 w-28 overflow-hidden rounded-lg border border-dashed border-muted-foreground/30">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={field.value}
                                      alt="Init image preview"
                                      className="h-full w-full object-cover"
                                    />
                                  </div>
                                ) : null}
                              </div>
                              <FormDescription>PNG/JPEG up to 25 MB.</FormDescription>
                              {missingInitImage ? (
                                <p className="text-xs text-rose-500">This engine needs an init image.</p>
                              ) : null}
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ) : null}
                      {modelSpec?.supports.mask ? (
                        <FormField
                          control={form.control}
                          name="maskUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Mask</FormLabel>
                              <div className="flex flex-col gap-2">
                                <input
                                  type="file"
                                  accept="image/png,image/*"
                                  ref={fileInputs.maskUrl}
                                  className="hidden"
                                  onChange={async (event) => {
                                    await handleFileSelection("maskUrl", event.target.files);
                                    event.target.value = "";
                                  }}
                                />
                                <div className="flex flex-wrap items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => fileInputs.maskUrl.current?.click()}
                                    disabled={isUploading("maskUrl") || isSubmitting}
                                  >
                                    <Upload className="mr-2 h-4 w-4" />
                                    {isUploading("maskUrl") ? "Uploading..." : "Upload mask"}
                                  </Button>
                                  {field.value ? (
                                    <span className="truncate text-xs text-muted-foreground">
                                      {field.value.split("/").pop()}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">No mask selected</span>
                                  )}
                                  {field.value ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => field.onChange(undefined)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      <span className="sr-only">Remove mask</span>
                                    </Button>
                                  ) : null}
                                </div>
                                {field.value ? (
                                  <div className="mt-2 h-28 w-28 overflow-hidden rounded-lg border border-dashed border-muted-foreground/30">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={field.value}
                                      alt="Mask preview"
                                      className="h-full w-full object-cover"
                                    />
                                  </div>
                                ) : null}
                              </div>
                              <FormDescription>Transparent PNG aligned with init image.</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ) : null}
                      {modelSpec?.supports.imageReference ? (
                        <FormField
                          control={form.control}
                          name="referenceImageUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Reference image</FormLabel>
                              <div className="flex flex-col gap-2">
                                <input
                                  type="file"
                                  accept="image/*"
                                  ref={fileInputs.referenceImageUrl}
                                  className="hidden"
                                  onChange={async (event) => {
                                    await handleFileSelection("referenceImageUrl", event.target.files);
                                    event.target.value = "";
                                  }}
                                />
                                <div className="flex flex-wrap items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => fileInputs.referenceImageUrl.current?.click()}
                                    disabled={isUploading("referenceImageUrl") || isSubmitting}
                                  >
                                    <Upload className="mr-2 h-4 w-4" />
                                    {isUploading("referenceImageUrl") ? "Uploading..." : "Upload reference"}
                                  </Button>
                                  {field.value ? (
                                    <span className="truncate text-xs text-muted-foreground">
                                      {field.value.split("/").pop()}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">No file selected</span>
                                  )}
                                  {field.value ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => field.onChange(undefined)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      <span className="sr-only">Remove reference image</span>
                                    </Button>
                                  ) : null}
                                </div>
                                {field.value ? (
                                  <div className="mt-2 h-28 w-28 overflow-hidden rounded-lg border border-dashed border-muted-foreground/30">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={field.value}
                                      alt="Reference image preview"
                                      className="h-full w-full object-cover"
                                    />
                                  </div>
                                ) : null}
                              </div>
                              <FormDescription>Style or brand reference imagery.</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ) : null}
                      {modelSpec?.supports.refVideo ? (
                        <FormField
                          control={form.control}
                          name="referenceVideoUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2">
                                Reference video
                                {refVideoRequired ? (
                                  <Badge
                                    variant="outline"
                                    className="border-rose-500/60 bg-rose-500/10 text-[10px] font-semibold uppercase tracking-wide text-rose-600"
                                  >
                                    Required
                                  </Badge>
                                ) : null}
                              </FormLabel>
                              <div className="flex flex-col gap-2">
                                <input
                                  type="file"
                                  accept="video/mp4,video/quicktime,video/*"
                                  ref={fileInputs.referenceVideoUrl}
                                  className="hidden"
                                  onChange={async (event) => {
                                    await handleFileSelection("referenceVideoUrl", event.target.files);
                                    event.target.value = "";
                                  }}
                                />
                                <div className="flex flex-wrap items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => fileInputs.referenceVideoUrl.current?.click()}
                                    disabled={isUploading("referenceVideoUrl") || isSubmitting}
                                  >
                                    <Upload className="mr-2 h-4 w-4" />
                                    {isUploading("referenceVideoUrl") ? "Uploading..." : "Upload video"}
                                  </Button>
                                  {field.value ? (
                                    <span className="truncate text-xs text-muted-foreground">
                                      {field.value.split("/").pop()}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">No video selected</span>
                                  )}
                                  {field.value ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => field.onChange(undefined)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      <span className="sr-only">Remove reference video</span>
                                    </Button>
                                  ) : null}
                                </div>
                                {field.value ? (
                                  <div className="mt-2 w-full max-w-xs overflow-hidden rounded-lg border border-dashed border-muted-foreground/30">
                                    <video
                                      src={field.value}
                                      controls
                                      className="h-40 w-full rounded-lg object-cover"
                                    />
                                  </div>
                                ) : null}
                              </div>
                              <FormDescription>Short MP4 or MOV reference clip.</FormDescription>
                              {missingReferenceVideo ? (
                                <p className="text-xs text-rose-500">Add a reference video to unlock this model.</p>
                              ) : null}
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ) : null}
                    </div>
                  </div>
                ) : null}
                {modelSpec?.supports.negativePrompt ? (
                  <FormField
                    control={form.control}
                    name="negativePrompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Negative prompt</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={3}
                            placeholder="Describe what to avoid (e.g. --no artifacts, --no blur)"
                            className="border-black/10 bg-white text-sm text-foreground dark:border-white/10 dark:bg-[#162130] dark:text-slate-100"
                            {...field}
                            value={field.value ?? ""}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}
              </section>
              <section className="space-y-4 overflow-hidden rounded-[24px] border border-black/10 bg-white/90 p-4 shadow-[0_35px_100px_-70px_rgba(17,24,39,0.35)] backdrop-blur dark:border-white/10 dark:bg-[#101827]">
                <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                  Advanced controls
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {fpsRange ? (
                    <FormField
                      control={form.control}
                      name="fps"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>FPS</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={fpsRange.min}
                              max={fpsRange.max}
                              step={fpsRange.step ?? 1}
                              className="border-black/10 bg-white text-sm text-foreground dark:border-white/10 dark:bg-[#162130] dark:text-slate-100"
                              value={field.value ?? ""}
                              onChange={(event) => field.onChange(event.target.valueAsNumber)}
                            />
                          </FormControl>
                          <FormDescription>
                            {fpsRange.min}-{fpsRange.max} fps
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : null}
                  {motionRange ? (
                    <FormField
                      control={form.control}
                      name="motionStrength"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Motion strength</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={motionRange.min}
                              max={motionRange.max}
                              step={motionRange.step ?? 0.05}
                              className="border-black/10 bg-white text-sm text-foreground dark:border-white/10 dark:bg-[#162130] dark:text-slate-100"
                              value={field.value ?? ""}
                              onChange={(event) => field.onChange(parseFloat(event.target.value))}
                            />
                          </FormControl>
                          <FormDescription>
                            {motionRange.min.toFixed(2)}-{motionRange.max.toFixed(2)}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : null}
                  {cfgRange ? (
                    <FormField
                      control={form.control}
                      name="cfgScale"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CFG scale</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={cfgRange.min}
                              max={cfgRange.max}
                              step={cfgRange.step ?? 0.5}
                              className="border-black/10 bg-white text-sm text-foreground dark:border-white/10 dark:bg-[#162130] dark:text-slate-100"
                              value={field.value ?? ""}
                              onChange={(event) => field.onChange(parseFloat(event.target.value))}
                            />
                          </FormControl>
                          <FormDescription>
                            {cfgRange.min}-{cfgRange.max}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : null}
                  {stepsRange ? (
                    <FormField
                      control={form.control}
                      name="steps"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Steps</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={stepsRange.min}
                              max={stepsRange.max}
                              step={stepsRange.step ?? 1}
                              className="border-black/10 bg-white text-sm text-foreground dark:border-white/10 dark:bg-[#162130] dark:text-slate-100"
                              value={field.value ?? ""}
                              onChange={(event) => field.onChange(event.target.valueAsNumber)}
                            />
                          </FormControl>
                          <FormDescription>
                            {stepsRange.min}-{stepsRange.max} steps
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : null}
                  <FormField
                    control={form.control}
                    name="seed"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Seed (optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            className="border-black/10 bg-white text-sm text-foreground dark:border-white/15 dark:bg-black/40"
                            value={field.value ?? ""}
                            onChange={(event) =>
                              field.onChange(event.target.value ? event.target.valueAsNumber : undefined)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {modelSpec?.supports.watermarkToggle ? (
                    <FormField
                      control={form.control}
                      name="watermark"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-[#162130]">
                          <div className="space-y-0.5">
                            <FormLabel className="text-sm">Watermark</FormLabel>
                            <FormDescription>Toggle the provider watermark.</FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value ?? true} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  ) : null}
                  {modelSpec?.supports.upscaling ? (
                    <FormField
                      control={form.control}
                      name="upscaling"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-[#162130]">
                          <div className="space-y-0.5">
                            <FormLabel className="text-sm">High-res mode</FormLabel>
                            <FormDescription>Upscale the final output.</FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  ) : null}
                </div>
              </section>
            </div>
          </form>
        </Form>
      </CardContent>
      <Dialog open={Boolean(confirmData)} onOpenChange={() => setConfirmData(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm budget override</DialogTitle>
            <DialogDescription>
              The server estimate exceeds your budget.
            </DialogDescription>
          </DialogHeader>
          {confirmData ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span>Estimated total</span>
                <span className="font-medium">{(confirmData.serverCostCents / 100).toFixed(2)} €</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Budget</span>
                <span>{(confirmData.budgetCents / 100).toFixed(2)} €</span>
              </div>
              {confirmData.suggestion?.engine ? (
                <p className="text-xs text-muted-foreground">
                  Suggestion: switch engine to <span className="font-medium">{confirmData.suggestion.engine}</span> and
                  save, estimated {(Number(confirmData.suggestion.estimatedCents) / 100).toFixed(2)} €.
                </p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmData(undefined)}>
              Cancel
            </Button>
            <Button onClick={confirmBudgetAndSubmit}>Confirm and generate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

const JOB_STATUS_LABELS: Record<string, string> = {
  pending: "Queued",
  running: "Rendering",
  completed: "Ready",
  failed: "Failed",
};

type VideoPreviewPanelProps = {
  job: SerializedJob | null;
  isSubmitting: boolean;
  onShare: (job: SerializedJob) => void;
  className?: string;
};

function VideoPreviewPanel({ job, isSubmitting, onShare, className }: VideoPreviewPanelProps) {
  const hasVideo = Boolean(job && job.outputUrl);
  const isProcessing = Boolean(job && (job.status === "pending" || job.status === "running") && !job.outputUrl);
  const showLoader = !hasVideo && (isSubmitting || isProcessing);
  const statusLabel = job ? JOB_STATUS_LABELS[job.status] ?? job.status : undefined;
  const progressValue = job?.progress ?? 0;

  return (
    <div
      className={cn(
        "relative flex h-full flex-col gap-4 overflow-hidden rounded-[24px] border border-black/10 bg-white/90 p-4 text-foreground shadow-[0_30px_90px_-70px_rgba(17,24,39,0.25)] backdrop-blur dark:border-white/10 dark:bg-slate-950/85 dark:text-slate-100",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">Render preview</span>
        {statusLabel ? (
          <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
            {statusLabel}
          </Badge>
        ) : null}
      </div>
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-black/10 bg-slate-900/15 dark:border-white/10 dark:bg-slate-900/50">
        {hasVideo && job ? (
          <>
            <video
              className="h-full w-full object-cover"
              src={job.outputUrl ?? undefined}
              poster={typeof job.thumbnailUrl === "string" ? job.thumbnailUrl : undefined}
              controls
            />
            <div className="pointer-events-none absolute inset-0 flex items-start justify-end gap-2 p-3">
              <Button
                asChild
                size="sm"
                variant="secondary"
                className="pointer-events-auto bg-black/70 text-white backdrop-blur hover:bg-black/80"
              >
                <a href={job.outputUrl ?? undefined} download>
                  <Download className="mr-1 h-4 w-4" />
                  Download
                </a>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="pointer-events-auto bg-black/70 text-white backdrop-blur hover:bg-black/80"
                onClick={() => onShare(job)}
              >
                <Share2 className="mr-1 h-4 w-4" />
                Share
              </Button>
            </div>
          </>
        ) : showLoader ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/80 text-white">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-sm font-medium tracking-wide">Rendering your clip...</span>
            <span className="text-xs text-white/70">Hang tight, the preview will appear here once ready.</span>
          </div>
        ) : job && job.status === "failed" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-sm text-red-400">
            <span>Render failed.</span>
            {job.error ? <span className="text-xs text-white/70">{job.error}</span> : null}
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-xs text-white/60">
            <span>Your render preview will appear here once you launch a job.</span>
            <span>Describe your scene in the prompt and hit Generate clip.</span>
          </div>
        )}
      </div>
      {job ? (
        <div className="space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center justify-between text-foreground">
            <span>Progress</span>
            <span className="font-medium">{progressValue}%</span>
          </div>
          <Progress
            value={progressValue}
            className={cn(
              "h-2",
              job.status === "pending" || job.status === "running" ? "animate-pulse" : undefined,
            )}
          />
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground/80">
            <span>{job.ratio}</span>
            <span>•</span>
            <span>{job.durationSeconds} s</span>
            <span>•</span>
            <span>{job.withAudio ? "Audio ON" : "Audio OFF"}</span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Start a render to see progress and the final clip preview without leaving this page.
        </p>
      )}
    </div>
  );
}

function ActiveGlow() {
  return (
    <>
      <span className="pointer-events-none absolute inset-0 rounded-2xl border border-primary/55 opacity-70" />
      <span className="pointer-events-none absolute inset-1 rounded-2xl bg-primary/15 opacity-60 mix-blend-screen dark:bg-primary/35 dark:opacity-25" />
      <span className="absolute right-4 top-4 flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 opacity-75" />
        <span className="relative inline-flex h-full w-full rounded-full bg-primary" />
      </span>
    </>
  );
}
