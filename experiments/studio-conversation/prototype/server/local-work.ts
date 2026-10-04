import {
  copyFile,
  mkdir,
  rename,
  access,
  writeFile,
  rm,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ProjectStore } from "./store";
import type { Asset, Project, Job } from "../shared/types";
import type { Work } from "./jobs";
import { mediaDir, probeMedia, waveform } from "./media";
import { renderAnimation, renderSequence, ffmpeg, runProcess } from "./render";
const demoDir = resolve(
  fileURLToPath(new URL("../../assets/motion/", import.meta.url)),
);
const photos = [
  ["perfume-linen.jpg", "Lumière & lin"],
  ["perfume-hand.jpg", "Le geste"],
  ["perfume-caustic.jpg", "Reflets de verre"],
];
export function localWork(root: string, store?: ProjectStore): Work {
  return async (p, job, signal, progress) => {
    const dir = mediaDir(root, p.id);
    await mkdir(dir, { recursive: true });
    const asset = async (
      id: string,
      name: string,
      ext: string,
      make: (temp: string) => Promise<void>,
      origin: Asset["origin"] = "local",
    ): Promise<Asset> => {
      const file = id + ext,
        path = join(dir, file);
      let ready = false;
      try {
        await access(path);
        await probeMedia(path);
        ready = true;
      } catch {}
      if (!ready) {
        const temp = join(dir, id + ".partial" + ext);
        await make(temp);
        if (signal.aborted) throw new Error("Traitement annulé.");
        await rename(temp, path);
      }
      const a: Asset = { id, name, file, ...(await probeMedia(path)), origin };
      if (a.kind === "video") {
        a.poster = id + ".jpg";
        try {
          await access(join(dir, a.poster));
        } catch {
          await ffmpeg(
            [
              "-i",
              path,
              "-frames:v",
              "1",
              "-vf",
              "scale=640:-2",
              join(dir, a.poster),
            ],
            1,
            signal,
          );
        }
      }
      if (a.kind === "audio") a.peaks = await waveform(path);
      if (store && job.kind !== "export")
        await store.update(p.id, (p) => {
          const j = p.jobs.find((j) => j.id === job.id);
          if (j?.state === "running" && !signal.aborted) {
            if (!p.assets.some((asset) => asset.id === a.id)) p.assets.push(a);
            const message = p.messages.find((m) => m.jobId === job.id);
            if (message)
              message.assets = [...new Set([...(message.assets ?? []), a.id])];
          }
          return p;
        });
      return a;
    };
    const params = job.params,
      results: Asset[] = [];
    if (job.kind === "images") {
      const count = Number(params.count ?? 3);
      for (let i = 0; i < count; i++) {
        const [photo, name] = photos[i % photos.length];
        results.push(
          await asset(
            job.outputIds[i],
            name,
            ".jpg",
            (temp) => copyFile(join(demoDir, photo), temp),
            "demo",
          ),
        );
        progress(((i + 1) / count) * (params.buildFilm ? 0.05 : 0.99));
      }
      if (params.buildFilm) {
        const duration = Math.min(30, Number(params.targetDuration) / count);
        for (let i = 0; i < count; i++)
          results.push(
            await asset(
              job.outputIds[count + i],
              results[i].name + " · animé",
              ".mp4",
              (temp) =>
                renderAnimation(
                  join(dir, results[i].file),
                  temp,
                  { duration, motion: "gentle", fps: Number(params.fps) },
                  signal,
                  (n) => progress(0.05 + ((i + n) / count) * 0.94),
                ),
              "demo",
            ),
          );
      }
    } else if (job.kind === "animate") {
      const source = p.assets.find((a) => a.id === params.assetId)!;
      results.push(
        await asset(
          job.outputIds[0],
          source.name + " · animé",
          ".mp4",
          (temp) =>
            renderAnimation(
              join(dir, source.file),
              temp,
              {
                duration: Number(params.duration),
                motion: params.motion as "gentle",
                fps: Number(params.fps),
              },
              signal,
              progress,
            ),
          source.origin,
        ),
      );
    } else if (job.kind === "music") {
      const duration = Number(params.duration);
      results.push(
        await asset(
          job.outputIds[0],
          "Ambiance · Lumière douce",
          ".mp3",
          (temp) =>
            ffmpeg(
              [
                "-f",
                "lavfi",
                "-i",
                `aevalsrc=0.05*sin(2*PI*130.81*t)+0.035*sin(2*PI*196*t)+0.025*sin(2*PI*261.63*t):s=48000:d=${duration}`,
                "-af",
                `afade=t=in:d=1,afade=t=out:st=${Math.max(0, duration - 2)}:d=2`,
                "-c:a",
                "libmp3lame",
                "-b:a",
                "192k",
                temp,
              ],
              duration,
              signal,
              progress,
            ),
        ),
      );
    } else if (job.kind === "voice") {
      results.push(
        await asset(
          job.outputIds[0],
          "Voix · " + String(params.text).slice(0, 40),
          ".mp3",
          async (temp) => {
            const text = join(dir, job.id + ".txt"),
              speech = join(dir, job.id + ".aiff");
            await writeFile(text, String(params.text));
            try {
              await runProcess(
                "/usr/bin/say",
                ["-v", "Thomas", "-r", "155", "-f", text, "-o", speech],
                signal,
              );
              progress(0.4);
              await ffmpeg(
                [
                  "-i",
                  speech,
                  "-af",
                  "apad=pad_dur=1",
                  "-c:a",
                  "libmp3lame",
                  "-b:a",
                  "192k",
                  temp,
                ],
                10,
                signal,
                (n) => progress(0.4 + n * 0.6),
              );
            } finally {
              await rm(text, { force: true });
              await rm(speech, { force: true });
            }
          },
        ),
      );
    } else if (job.kind === "export") {
      const video = job.snapshot!.clips.some((c) => c.track === "video"),
        ext = video ? ".mp4" : ".mp3";
      results.push(
        await asset(
          job.outputIds[0],
          job.snapshot!.title + " · rendu",
          ext,
          (temp) => renderSequence(job.snapshot!, dir, temp, signal, progress),
        ),
      );
    }
    return results;
  };
}
