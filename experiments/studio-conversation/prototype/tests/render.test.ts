import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderSequence, runProcess } from "../server/render";
import { probeMedia, importMedia, mediaDir } from "../server/media";
import { fixture } from "./fixtures";
test("actual film converts 30 fps sources to 24 fps with trims, soundtrack and audio-only export", async () => {
  const dir = await mkdtemp(join(tmpdir(), "studio-render-"));
  try {
    await runProcess("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=blue:s=320x180:r=30:d=3",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=220:duration=3",
      "-shortest",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      join(dir, "a.mp4"),
    ]);
    await runProcess("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=3",
      join(dir, "b.mp3"),
    ]);
    const p = fixture();
    p.assets[0].duration = 3;
    p.assets[1].duration = 3;
    p.clips = [
      {
        id: "one",
        assetId: "a",
        track: "video",
        inFrame: 24,
        outFrame: 48,
        startFrame: 0,
        volume: 1,
      },
      {
        id: "two",
        assetId: "a",
        track: "video",
        inFrame: 0,
        outFrame: 48,
        startFrame: 0,
        volume: 1,
      },
      {
        id: "voice",
        assetId: "b",
        track: "voice",
        inFrame: 0,
        outFrame: 48,
        startFrame: 24,
        volume: 0.8,
      },
    ];
    const snapshot = { ...p, revision: 0 };
    await renderSequence(snapshot, dir, join(dir, "film.mp4"));
    const info = await probeMedia(join(dir, "film.mp4"));
    assert.equal(info.width, 1280);
    assert.equal(info.height, 720);
    assert.equal(info.hasAudio, true);
    const videoStream = JSON.parse(
      (
        await runProcess("ffprobe", [
          "-v",
          "error",
          "-show_streams",
          "-of",
          "json",
          join(dir, "film.mp4"),
        ])
      ).toString(),
    ).streams.find((stream: any) => stream.codec_type === "video");
    assert.equal(videoStream.r_frame_rate, "24/1");
    assert.equal(Number(videoStream.nb_frames), 72);

    assert.ok(Math.abs(info.duration - 3) < 1 / 24);
    snapshot.clips = [
      {
        id: "voice",
        assetId: "b",
        track: "voice",
        inFrame: 24,
        outFrame: 72,
        startFrame: 0,
        volume: 1,
      },
    ];
    await renderSequence(snapshot, dir, join(dir, "podcast.mp3"));
    const audio = await probeMedia(join(dir, "podcast.mp3"));
    assert.equal(audio.kind, "audio");
    assert.ok(Math.abs(audio.duration - 2) < 0.1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("a soundtrack extending beyond the last shot exports the same held frame duration as preview", async () => {
  const dir = await mkdtemp(join(tmpdir(), "studio-tail-"));
  try {
    await runProcess("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=blue:s=320x180:r=24:d=1",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      join(dir, "a.mp4"),
    ]);
    await runProcess("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=3",
      join(dir, "b.mp3"),
    ]);
    const p = fixture();
    p.assets[0].duration = 1;
    p.assets[0].hasAudio = false;
    p.assets[1].duration = 3;
    p.clips = [
      {
        id: "v",
        assetId: "a",
        track: "video",
        inFrame: 0,
        outFrame: 24,
        startFrame: 0,
        volume: 1,
      },
      {
        id: "a",
        assetId: "b",
        track: "music",
        inFrame: 0,
        outFrame: 72,
        startFrame: 0,
        volume: 0.25,
      },
    ];
    await renderSequence(p, dir, join(dir, "tail.mp4"));
    const streams = JSON.parse(
      (
        await runProcess("ffprobe", [
          "-v",
          "error",
          "-show_streams",
          "-of",
          "json",
          join(dir, "tail.mp4"),
        ])
      ).toString(),
    ).streams;
    const videoDuration = Number(
      streams.find((s: any) => s.codec_type === "video").duration,
    );
    assert.ok(
      Math.abs(videoDuration - 3) < 1 / 24,
      `Video stream duration: ${videoDuration}; expected 3 seconds`,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("unequal video/audio streams import to playable video length and every exported shot retains its frame count", async () => {
  const root = await mkdtemp(join(tmpdir(), "studio-streams-"));
  try {
    const input = join(root, "source.mp4");
    await runProcess("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=red:s=160x90:r=30:d=2",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=3",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      input,
    ]);
    const projectId = crypto.randomUUID();
    const imported = await importMedia(
      root,
      projectId,
      await readFile(input),
      "Reference.mp4",
    );
    assert.ok(
      Math.abs(imported.duration - 2) < 1 / 30,
      `Playable video duration: ${imported.duration}`,
    );
    const p = fixture();
    p.assets = [imported];
    const count = Math.floor(imported.duration * 24);
    p.clips = ["one", "two"].map((id) => ({
      id,
      assetId: imported.id,
      track: "video" as const,
      inFrame: 0,
      outFrame: count,
      startFrame: 0,
      volume: 1,
    }));
    const dir = mediaDir(root, projectId),
      output = join(dir, "film.mp4");
    await renderSequence(p, dir, output);
    const streams = JSON.parse(
      (
        await runProcess("ffprobe", [
          "-v",
          "error",
          "-show_streams",
          "-of",
          "json",
          output,
        ])
      ).toString(),
    ).streams;
    assert.equal(
      Number(streams.find((s: any) => s.codec_type === "video").nb_frames),
      count * 2,
    );
    assert.ok(
      Math.abs(
        Number(streams.find((s: any) => s.codec_type === "audio").duration) -
          (count * 2) / 24,
      ) <
        1 / 24,
    );
    const pcm = await runProcess("ffmpeg", [
      "-v",
      "error",
      "-i",
      output,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "8000",
      "-f",
      "f32le",
      "pipe:1",
    ]);
    for (const seconds of [0.5, 2.5]) {
      const values = Array.from({ length: 800 }, (_, i) =>
        pcm.readFloatLE((Math.round(seconds * 8000) + i) * 4),
      );
      const rms = Math.sqrt(
        values.reduce((n, v) => n + v * v, 0) / values.length,
      );
      assert.ok(rms > 0.03, `Decoded source audio at ${seconds}s: RMS ${rms}`);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("saved sources shorter than their declared shot hold the last frame without shifting the next cut", async () => {
  const dir = await mkdtemp(join(tmpdir(), "studio-legacy-"));
  try {
    await runProcess("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=blue:s=160x90:r=30:d=2",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      join(dir, "a.mp4"),
    ]);
    const p = fixture();
    p.assets = p.assets.slice(0, 1);
    p.assets[0].duration = 3;
    p.assets[0].hasAudio = false;
    p.clips = ["one", "two"].map((id) => ({
      id,
      assetId: "a",
      track: "video" as const,
      inFrame: 0,
      outFrame: 72,
      startFrame: 0,
      volume: 1,
    }));
    await renderSequence(p, dir, join(dir, "legacy.mp4"));
    const streams = JSON.parse(
      (
        await runProcess("ffprobe", [
          "-v",
          "error",
          "-show_streams",
          "-of",
          "json",
          join(dir, "legacy.mp4"),
        ])
      ).toString(),
    ).streams;
    assert.equal(
      Number(streams.find((s: any) => s.codec_type === "video").nb_frames),
      144,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
