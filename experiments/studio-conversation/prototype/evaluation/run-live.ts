import assert from "node:assert/strict";
import { mkdir, copyFile, writeFile, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AiDirector,
  type ModelClient,
  type ModelReply,
} from "../server/ai-director";
import { OpenAIResponses } from "../server/openai-client";
import { ProjectStore } from "../server/store";
import { CommandService } from "../server/commands";
import { MediaLibraryService } from "../server/library";
import { JobRunner } from "../server/jobs";
import { localWork } from "../server/local-work";
import { mediaDir, probeMedia } from "../server/media";
import { ffmpeg } from "../server/render";
import type { Asset, Project, Command } from "../shared/types";

// Opt-in integration evaluation. It never reads the running Studio's projects,
// contacts a media provider, or changes the production account/database.
if (!process.argv.includes("--live")) {
  console.error(
    "Évaluation API payante : ajouter --live et configurer STUDIO_ENV_FILE ou STUDIO_OPENAI_API_KEY.",
  );
  process.exit(1);
}
if (process.env.STUDIO_ENV_FILE)
  process.loadEnvFile(process.env.STUDIO_ENV_FILE);
const key = process.env.STUDIO_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
if (!key) throw new Error("Clé OpenAI serveur requise.");
const base = fileURLToPath(new URL("../", import.meta.url));
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const root = join(base, ".data", "evaluations", runId);
await mkdir(root, { recursive: true });
const store = new ProjectStore(join(root, "projects"));
const service = new CommandService(store);
const library = new MediaLibraryService(store, root);
const work = localWork(root, store);
const runner = new JobRunner(store, async (project, job, signal, progress) => {
  // Force real dependencies to outlive an ordinary model response. This catches
  // workflows that only succeed because a demo worker happens to be fast.
  if (
    project.title === "QA · Film complet" &&
    ["animate", "voice"].includes(job.kind)
  )
    await new Promise((resolve) => setTimeout(resolve, 12000));
  return work(project, job, signal, progress);
});
const api = new OpenAIResponses(key);
const calls: {
  durationMs: number;
  responseId: string;
  model: string | null;
  serviceTier: string | null;
  usage?: ModelReply["usage"];
  tools: string[];
}[] = [];
const client: ModelClient = {
  create: async (request) => {
    if (calls.length >= 45) throw new Error("Plafond de 45 appels atteint.");
    if (calls.reduce((n, c) => n + (c.usage?.totalTokens ?? 0), 0) >= 250000)
      throw new Error("Budget d'évaluation en tokens atteint.");
    const start = performance.now();
    const reply = await api.create(request);
    calls.push({
      durationMs: Math.round(performance.now() - start),
      responseId: reply.id,
      model: reply.model ?? null,
      serviceTier: reply.serviceTier ?? null,
      usage: reply.usage,
      tools: reply.output
        .filter((i) => i.type === "function_call")
        .map((i) => i.name),
    });
    return reply;
  },
};
const director = new AiDirector(service, library, root, client);
const rows: {
  case: string;
  prompts: string[];
  passed: boolean;
  checks: string[];
  replies: string[];
  calls: number;
  durationMs: number;
  usage: Record<string, number | null>;
  error?: string;
}[] = [];
let active: (typeof rows)[number];
let commandIndex = 0;
const edit = async (p: Project, command: Command) =>
  (
    await service.execute(p.id, {
      requestId: "fixture-" + ++commandIndex,
      expectedRevision: (await store.get(p.id)).revision,
      command,
    })
  ).project;
const check = (condition: unknown, description: string) => {
  assert.ok(condition, description);
  active.checks.push(description);
};
const ask = async (
  p: Project,
  text: string,
  context?: { clipId?: string; assetIds?: string[] },
) => {
  active.prompts.push(text);
  const result = await director.respond(p.id, {
    requestId: crypto.randomUUID(),
    text,
    context,
  });
  active.replies.push(result.project.messages.at(-1)?.text ?? "");
  return result.project;
};
async function asset(p: Project, name: string, source: string): Promise<Asset> {
  const id = crypto.randomUUID();
  const file = id + source.slice(source.lastIndexOf("."));
  const dir = mediaDir(root, p.id);
  await mkdir(dir, { recursive: true });
  await copyFile(source, join(dir, file));
  const a: Asset = {
    id,
    name,
    file,
    ...(await probeMedia(join(dir, file))),
    origin: "import",
  };
  if (a.kind === "video") {
    a.poster = id + ".jpg";
    await ffmpeg(
      [
        "-i",
        join(dir, file),
        "-frames:v",
        "1",
        "-vf",
        "scale=640:-2",
        join(dir, a.poster),
      ],
      1,
      new AbortController().signal,
    );
  }
  await store.update(p.id, (p) => {
    p.assets.push(a);
    return p;
  });
  return a;
}
const demoImage = resolve(base, "public/demo/linen.jpg");
const demoVideo = resolve(base, "../assets/watch-demo.mp4");
const watch = resolve(base, "../assets/watch-reference.webp");
const voice = join(root, "fixture-voice.mp3"),
  music = join(root, "fixture-music.mp3");
for (const [path, frequency, duration] of [
  [voice, 400, 5],
  [music, 120, 18],
] as const)
  await ffmpeg(
    [
      "-f",
      "lavfi",
      "-i",
      `sine=frequency=${frequency}:duration=${duration}`,
      "-c:a",
      "libmp3lame",
      path,
    ],
    duration,
    new AbortController().signal,
  );
async function scenario(name: string, work: () => Promise<void>) {
  const start = performance.now(),
    firstCall = calls.length;
  active = {
    case: name,
    prompts: [],
    passed: false,
    checks: [],
    replies: [],
    calls: 0,
    durationMs: 0,
    usage: {},
  };
  rows.push(active);
  try {
    await work();
    active.passed = true;
  } catch (error) {
    active.error = error instanceof Error ? error.message : "Échec";
  }
  const subset = calls.slice(firstCall);
  active.calls = subset.length;
  active.durationMs = Math.round(performance.now() - start);
  for (const c of subset)
    for (const [k, v] of Object.entries(c.usage ?? {}))
      active.usage[k] = v === null || active.usage[k] === null
        ? null
        : (active.usage[k] ?? 0) + v;
  await writeFile(
    join(root, "report.json"),
    JSON.stringify({ runId, model: "gpt-6.1-sol", rows, calls }, null, 2),
    { mode: 0o600 },
  );
  console.log(JSON.stringify(active));
}
runner.start();
try {
  await scenario("Brief créatif sans génération", async () => {
    const p = await store.create("QA · Brief");
    const next = await ask(
      p,
      "Une pub de parfum de quinze secondes, lumineuse mais pas cliché luxe. Propose une direction en deux phrases et règle le projet en vertical. Ne crée aucun média pour l'instant.",
    );
    check(
      next.settings.ratio === "9:16" && next.settings.targetDuration === 15,
      "Format et durée du brief appliqués",
    );
    check(
      next.jobs.length === 0 && next.clips.length === 0,
      "Aucune génération ni montage non demandé",
    );
    check(
      next.messages
        .filter((m) => m.role === "assistant")
        .map((m) => m.text)
        .join(" ").length > 100,
      "Proposition créative conservée dans le chat (revue humaine nécessaire)",
    );
  });
  await scenario(
    "Coupe, ordre, son et annulation en conversation",
    async () => {
      let p = await store.create("QA · Corrections");
      const a = await asset(p, "Ouverture", demoVideo),
        b = await asset(p, "Détail", demoVideo),
        v = await asset(p, "Voix de référence", voice);
      p = await edit(p, { type: "assemble", assetIds: [a.id, b.id] });
      const selected = p.clips[1].id;
      p = await ask(
        p,
        "Sur le plan sélectionné, garde seulement de la seconde 1 à la seconde 5 de la source, puis passe-le avant l'autre plan.",
        { clipId: selected },
      );
      check(
        p.clips[0].id === selected &&
          p.clips[0].inFrame === 24 &&
          p.clips[0].outFrame === 120,
        "Coupe source et déplacement exacts à 24 fps",
      );
      p = await ask(
        p,
        "Ajoute la voix existante à trois secondes du début du film, sur la piste voix, et mets son volume à quarante pour cent.",
      );
      check(
        p.clips.some(
          (c) =>
            c.assetId === v.id &&
            c.track === "voice" &&
            c.startFrame === 72 &&
            c.volume === 0.4,
        ),
        "Voix positionnée à 3 s et 40 %",
      );
      p = await ask(p, "Annule seulement la dernière modification.");
      check(
        p.clips.find((c) => c.assetId === v.id)?.volume === 1,
        "Undo du volume sans supprimer la voix",
      );
      p = await ask(p, "Finalement rétablis cette dernière modification.");
      check(
        p.clips.find((c) => c.assetId === v.id)?.volume === 0.4,
        "Redo compris dans la conversation",
      );
    },
  );
  await scenario("Correction du cadrage vertical", async () => {
    let p = await store.create("QA · Cadrage");
    const a = await asset(p, "Montre horizontale", demoVideo);
    p = await edit(p, { type: "insert", assetId: a.id });
    p = await edit(p, {
      type: "settings",
      settings: { ratio: "9:16", fit: "cover" },
    });
    const next = await ask(
      p,
      "Le cadrage coupe ma montre. Je veux garder toute l'image, même s'il y a des bandes. Conserve le format vertical et ne touche pas à la coupe.",
    );
    check(
      next.settings.ratio === "9:16" && next.settings.fit === "contain",
      "Image entière dans le format vertical",
    );
    check(
      JSON.stringify(next.clips) === JSON.stringify(p.clips),
      "Coupe et ordre conservés",
    );
  });
  await scenario("Podcast avec deux audios existants", async () => {
    const p = await store.create("QA · Podcast");
    const v = await asset(p, "Parole podcast", voice),
      m = await asset(p, "Ambiance podcast", music);
    const next = await ask(
      p,
      "Fais un montage audio seul : la parole dès le début sur voix, l'ambiance dès le début sur musique à vingt pour cent. Ne génère rien et n'exporte pas encore.",
      { assetIds: [v.id, m.id] },
    );
    check(
      next.clips.length === 2 &&
        next.clips.every((c) => c.track !== "video" && c.startFrame === 0),
      "Deux pistes audio sans vidéo",
    );
    check(
      next.clips.find((c) => c.assetId === m.id)?.volume === 0.2,
      "Ambiance à 20 %",
    );
    check(next.jobs.length === 0, "Aucun rendu ni génération anticipé");
  });
  await scenario("Limite d'analyse interview et audio", async () => {
    const p = await store.create("QA · Analyse");
    const v = await asset(p, "Interview inconnue", demoVideo),
      a = await asset(p, "Enregistrement inconnu", voice);
    const next = await ask(
      p,
      "Écoute cet enregistrement, regarde toute l'interview et coupe le passage où la personne dit bonjour. Si tu n'as pas accès au contenu, dis-le clairement et ne fais aucune coupe au hasard.",
      { assetIds: [v.id, a.id] },
    );
    check(
      next.revision === 0 && next.jobs.length === 0 && next.clips.length === 0,
      "Aucune analyse ou coupe inventée",
    );
    check(
      /(ne peux|pas accès|uniquement|métadonnées|poster)/i.test(
        next.messages.at(-1)?.text ?? "",
      ),
      "Limites explicites (revue humaine nécessaire)",
    );
  });
  await scenario("Huit références dont la sixième différente", async () => {
    const p = await store.create("QA · Références");
    const ids: string[] = [];
    for (let i = 0; i < 8; i++)
      ids.push(
        (await asset(p, `Référence ${i + 1}`, i === 5 ? watch : demoImage)).id,
      );
    const next = await ask(
      p,
      "Décris seulement la sixième image jointe en une phrase : quel est l'objet principal ? Ne modifie rien.",
      { assetIds: ids },
    );
    check(
      /montre|watch/i.test(next.messages.at(-1)?.text ?? ""),
      "La sixième image est réellement comprise",
    );
    check(
      next.revision === 0 && next.jobs.length === 0,
      "Références consultées sans modification",
    );
  });
  await scenario("Bibliothèque partagée et source préservée", async () => {
    const source = await store.create("QA · Source bibliothèque"),
      destination = await store.create("QA · Destination");
    const a = await asset(source, "Plan partagé unique", demoVideo);
    const before = await readFile(store.path(source.id));
    const next = await ask(
      destination,
      "Cherche le plan vidéo nommé Plan partagé unique dans la bibliothèque, ajoute-le au montage et garde ses trois premières secondes.",
    );
    check(
      next.clips.length === 1 && next.clips[0].outFrame === 72,
      "Média recherché, adopté et coupé à 3 s",
    );
    check(
      next.clips[0].assetId !== a.id &&
        next.assets[0]?.librarySource?.assetId === a.id,
      "Identité adoptée et provenance conservées",
    );
    check(
      (await readFile(store.path(source.id))).equals(before),
      "Projet source inchangé octet pour octet",
    );
  });
  await scenario(
    "Demande complète animation, voix, montage, rendu",
    async () => {
      const p = await store.create("QA · Film complet"),
        a = await asset(p, "Parfum source", demoImage);
      const first = calls.length;
      const next = await ask(
        p,
        "Avec cette image, fais un plan animé de quatre secondes avec un mouvement doux, crée la voix française « La lumière a un parfum. », ajoute le plan et la voix au début du montage puis produis le MP4. Utilise seulement les traitements locaux disponibles, aucune nouvelle image.",
        { assetIds: [a.id] },
      );
      check(
        next.clips.some((c) => c.track === "video") &&
          next.clips.some((c) => c.track === "voice"),
        "Plans et voix insérés sans message intermédiaire utilisateur",
      );
      check(
        next.jobs.some((j) => j.kind === "export" && j.state === "ready"),
        "MP4 terminé dans le même parcours",
      );
      check(
        next.jobs.filter((j) => j.kind === "animate").length === 1 &&
          next.jobs.filter((j) => j.kind === "voice").length === 1,
        "Une seule animation et une seule voix",
      );
      check(
        calls.slice(first).some((c) => c.tools.includes("studio_wait")),
        "Attente des traitements lents sans polling du modèle",
      );
      const output = next.assets.find(
        (a) =>
          a.id === next.jobs.find((j) => j.kind === "export")?.outputIds[0],
      )!;
      const facts = await probeMedia(join(mediaDir(root, p.id), output.file));
      check(
        facts.kind === "video" &&
          facts.hasAudio &&
          Math.abs(facts.duration - 4) < 0.05,
        "MP4 image et son de quatre secondes mesuré par ffprobe",
      );
    },
  );
} finally {
  await runner.stop();
}
console.log(
  JSON.stringify({
    report: join(root, "report.json"),
    passed: rows.filter((r) => r.passed).length,
    total: rows.length,
    calls: calls.length,
  }),
);
process.exitCode = rows.every((r) => r.passed) ? 0 : 1;
