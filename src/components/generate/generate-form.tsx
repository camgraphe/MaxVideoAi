"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Sparkles, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PriceBadge } from "@/components/generate/price-badge";
import { generationPresets } from "@/data/presets";
import { ENGINE_LABELS, formatModelSummary, getModelSpecByEngine } from "@/data/models";
import { useToast } from "@/hooks/use-toast";
import { estimateCost } from "@/lib/pricing";
import type { EstimateCostOutput } from "@/types/pricing";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ratioOptions = ["9:16", "16:9", "1:1", "21:9"] as const;

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
  const modelSpec = React.useMemo(() => {
    if (provider !== "fal") return undefined;
    return getModelSpecByEngine("fal", engine);
  }, [provider, engine]);

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
    setIsSubmitting(true);
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

      toast({
        title: "Job launched",
        description: "Rendering has started. Redirecting you to live status.",
      });

      router.push(`/jobs/${payload.job.id}`);
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
      router.push(`/jobs/${payload.job.id}`);
    } catch (error) {
      setConfirmData(undefined);
      setIsSubmitting(false);
      toast({
        title: "Something went wrong",
        description: error instanceof Error ? error.message : "Unexpected error while confirming the job.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="border border-black/10 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-black/25">
      <CardHeader>
        <CardTitle>Generate a new clip</CardTitle>
        <CardDescription>
          Select a preset, tweak parameters, and preview the budget before you roll cameras.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="space-y-6">
              <section className="space-y-2">
                <Label>Presets</Label>
                <ScrollArea className="w-full overflow-hidden">
                  <div className="flex gap-4 pb-3 pr-2 snap-x snap-mandatory">
                    {generationPresets.map((preset) => {
                      const presetSpec = getModelSpecByEngine(preset.provider, preset.engine);
                      const isActive = selectedPresetId === preset.id;
                      return (
                        <button
                          type="button"
                          key={preset.id}
                          onClick={() => handlePresetChange(preset.id)}
                          className={cn(
                            "group relative flex min-w-[210px] max-w-[85vw] shrink-0 snap-start flex-col gap-2 rounded-2xl border border-black/10 bg-white p-4 text-left transition dark:border-white/10 dark:bg-black/30",
                            "hover:-translate-y-1 hover:border-primary/50",
                            isActive &&
                              "border-primary/60 shadow-[0_20px_55px_-35px_rgba(134,91,255,0.6)] dark:bg-[rgba(16,18,30,0.85)]"
                          )}
                        >
                          <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground/70">
                            <span className="text-foreground/70 dark:text-muted-foreground/70">
                              {preset.provider.toUpperCase()}
                            </span>
                            <span>
                              {preset.ratio} • {preset.durationSeconds}s • {preset.withAudio ? "Audio" : "Mute"}
                            </span>
                          </div>
                          <div className="space-y-1">
                            <p className="text-base font-semibold text-foreground">{preset.name}</p>
                            <p className="text-xs text-muted-foreground/90">{preset.description}</p>
                            {presetSpec ? (
                              <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">
                                {presetSpec.constraints.ratios.join(" / ")} ·
                                {" "}
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
                <div className="space-y-3 rounded-2xl border border-black/10 bg-white/80 p-4 text-sm dark:border-white/10 dark:bg-white/5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{modelSpec.label}</p>
                      <p className="text-xs text-muted-foreground">{modelSpec.description}</p>
                    </div>
                    <Badge variant="outline" className="uppercase">
                      {modelSpec.contentType === "video" ? "Video" : "Image"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
                    {modelSpec.supports.imageInit ? <span className="rounded-full bg-primary/10 px-2 py-1">Image init</span> : null}
                    {modelSpec.supports.mask ? <span className="rounded-full bg-primary/10 px-2 py-1">Mask</span> : null}
                    {modelSpec.supports.refVideo ? <span className="rounded-full bg-primary/10 px-2 py-1">Ref video</span> : null}
                    {modelSpec.supports.audio ? <span className="rounded-full bg-primary/10 px-2 py-1">Audio</span> : null}
                    {modelSpec.supports.seed ? <span className="rounded-full bg-primary/10 px-2 py-1">Seed</span> : null}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Ratios {modelSpec.constraints.ratios.join(" / ")}
                    {modelSpec.constraints.durationSeconds
                      ? ` • ${modelSpec.constraints.durationSeconds.min}-${modelSpec.constraints.durationSeconds.max}s`
                      : null}
                    {modelSpec.contentType === "image"
                      ? ` • ${modelSpec.constraints.resolution}`
                      : ` • ${modelSpec.constraints.resolution}`}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_1fr]">
                <div className="space-y-5">
                  <FormField
                    control={form.control}
                    name="engine"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel>Engine</FormLabel>
                        <div className="flex flex-wrap gap-2">
                          {engineOptions.map((option) => {
                            const isActive = field.value === option.value;
                            return (
                              <Button
                                key={option.value}
                                type="button"
                                className={cn(
                                  "border border-black/10 bg-white text-xs font-semibold uppercase tracking-wide text-muted-foreground transition dark:border-white/15 dark:bg-black/40 dark:text-muted-foreground",
                                  !isActive &&
                                    "hover:border-primary/40 hover:bg-primary/10 hover:text-primary dark:hover:bg-white/10 dark:hover:text-white",
                                  isActive &&
                                    "border-primary bg-primary text-primary-foreground shadow-[0_10px_24px_-18px_rgba(134,91,255,0.9)] hover:bg-primary/90 dark:border-white/40 dark:bg-white/15 dark:text-white"
                                )}
                                variant="outline"
                                onClick={() => field.onChange(option.value)}
                              >
                                {option.label}
                              </Button>
                            );
                          })}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="ratio"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel>Aspect ratio</FormLabel>
                        <div className="flex gap-2">
                          {(modelSpec?.constraints.ratios ?? ["9:16", "16:9"]).map((value) => {
                            const option = { value, label: value };
                            const isActive = field.value === option.value;
                            return (
                              <Button
                                key={option.value}
                                type="button"
                                className={cn(
                                  "flex-1 border border-black/10 bg-white text-sm font-semibold text-muted-foreground transition dark:border-white/15 dark:bg-black/40 dark:text-muted-foreground",
                                  !isActive &&
                                    "hover:border-primary/40 hover:bg-primary/10 hover:text-primary dark:hover:bg-white/10 dark:hover:text-white",
                                  isActive &&
                                    "border-primary bg-primary text-primary-foreground shadow-[0_10px_24px_-18px_rgba(134,91,255,0.9)] hover:bg-primary/90 dark:border-white/40 dark:bg-white/15 dark:text-white"
                                )}
                                variant="outline"
                                onClick={() => field.onChange(option.value)}
                              >
                                {option.label}
                              </Button>
                            );
                          })}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="durationSeconds"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Duration (s)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={durationRange?.min ?? 4}
                              max={durationRange?.max ?? 16}
                              step={durationRange?.step ?? 1}
                              disabled={!durationRange}
                              className="border-black/10 bg-white text-sm text-foreground dark:border-white/15 dark:bg-black/40"
                              value={field.value}
                              onChange={(event) => field.onChange(event.target.valueAsNumber)}
                            />
                          </FormControl>
                          {durationRange ? (
                            <FormDescription>
                              {durationRange.min}-{durationRange.max}s · step {durationRange.step ?? 1}s
                            </FormDescription>
                          ) : (
                            <FormDescription>Fixed runtime for this model.</FormDescription>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="quantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Variants</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              max={4}
                            className="border-black/10 bg-white text-sm text-foreground dark:border-white/15 dark:bg-black/40"
                              value={field.value}
                              onChange={(event) => field.onChange(event.target.valueAsNumber)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="withAudio"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-black/40">
                          <div className="space-y-0.5">
                            <FormLabel className="text-sm">Soundtrack</FormLabel>
                            <FormDescription>
                              {modelSpec?.supports.audio
                                ? "Generate the provider audio bed."
                                : "Audio not available for this engine."}
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

                  {(modelSpec?.supports.imageInit ||
                    modelSpec?.supports.imageReference ||
                    modelSpec?.supports.refVideo) && (
                    <div className="space-y-3">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                        Source assets
                      </Label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {modelSpec?.supports.imageInit ? (
                          <FormField
                            control={form.control}
                            name="inputImageUrl"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Init image</FormLabel>
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
                                      <span className="text-xs text-muted-foreground truncate">
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
                                      <span className="text-xs text-muted-foreground truncate">
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
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
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
                                      {isUploading("referenceImageUrl") ? "Uploading..." : "Upload image"}
                                    </Button>
                                    {field.value ? (
                                      <span className="text-xs text-muted-foreground truncate">
                                        {field.value.split("/").pop()}
                                      </span>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">No image selected</span>
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
                                <FormLabel>Reference video</FormLabel>
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
                                      <span className="text-xs text-muted-foreground truncate">
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
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        ) : null}
                      </div>
                    </div>
                  )}

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
                              className="border-black/10 bg-white text-sm text-foreground dark:border-white/15 dark:bg-black/40"
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

                  {(fpsRange || motionRange || cfgRange || stepsRange || modelSpec?.supports.watermarkToggle || modelSpec?.supports.upscaling) ? (
                    <div className="space-y-3">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                        Advanced controls
                      </Label>
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
                                    className="border-black/10 bg-white text-sm text-foreground dark:border-white/15 dark:bg-black/40"
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
                                    className="border-black/10 bg-white text-sm text-foreground dark:border-white/15 dark:bg-black/40"
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
                                    className="border-black/10 bg-white text-sm text-foreground dark:border-white/15 dark:bg-black/40"
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
                                    className="border-black/10 bg-white text-sm text-foreground dark:border-white/15 dark:bg-black/40"
                                    value={field.value ?? ""}
                                    onChange={(event) => field.onChange(event.target.valueAsNumber)}
                                  />
                                </FormControl>
                                <FormDescription>
                                  {stepsRange.min}-{stepsRange.max}
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        ) : null}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {modelSpec?.supports.watermarkToggle ? (
                          <FormField
                            control={form.control}
                            name="watermark"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-black/40">
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
                              <FormItem className="flex flex-row items-center justify-between rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-black/40">
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
                    </div>
                  ) : null}

                </div>

                <FormField
                  control={form.control}
                  name="prompt"
                  render={({ field }) => (
                    <FormItem className="flex h-full flex-col">
                      <FormLabel>Prompt</FormLabel>
                      <FormControl className="flex-1">
                        <Textarea
                          placeholder="Describe the scene, mood, camera moves, lighting cues, brand beats..."
                          className="h-full min-h-[220px] border border-black/10 bg-white text-sm text-foreground dark:border-white/15 dark:bg-black/40 md:min-h-[260px]"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Describe your shot in detail. Use the negative prompt panel to exclude artefacts.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6">
              <PriceBadge cost={cost} disabled={isSubmitting} />
              <Button type="submit" size="lg" className="gap-2" disabled={isSubmitting}>
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
