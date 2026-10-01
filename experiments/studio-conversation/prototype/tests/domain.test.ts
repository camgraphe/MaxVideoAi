import test from "node:test";
import assert from "node:assert/strict";
import { editSequence, sequenceDuration } from "../shared/timeline";
import type { Project } from "../shared/types";
import { fixture } from "./fixtures";
test("trim is frame aligned and source bounded; rejected commands leave the source intact", () => {
  const p = editSequence(fixture(), { type: "insert", assetId: "a" }),
    id = p.clips[0].id;
  const cut = editSequence(p, {
    type: "trim",
    clipId: id,
    inFrame: 48,
    outFrame: 144,
  });
  assert.equal(sequenceDuration(cut), 4);
  assert.equal(cut.clips[0].inFrame, 48);
  for (const [start, end] of [
    [-1, 48],
    [0, 241],
    [1.2, 100],
    [0, 23],
  ])
    assert.throws(() =>
      editSequence(p, {
        type: "trim",
        clipId: id,
        inFrame: start,
        outFrame: end,
      }),
    );
  assert.equal(p.clips[0].outFrame, 240);
});
test("reorder and undo/redo preserve trims and audio starts through fps change", () => {
  let p = editSequence(fixture(), { type: "insert", assetId: "a" });
  p = editSequence(p, { type: "insert", assetId: "a" });
  const first = p.clips[0].id;
  p = editSequence(p, {
    type: "trim",
    clipId: first,
    inFrame: 24,
    outFrame: 120,
  });
  p = editSequence(p, {
    type: "insert",
    assetId: "b",
    track: "voice",
    startFrame: 48,
  });
  p = editSequence(p, { type: "move", clipId: first, index: 1 });
  assert.equal(p.clips.filter((c) => c.track === "video")[1].id, first);
  p = editSequence(p, { type: "settings", settings: { fps: 30 } });
  assert.equal(p.clips.find((c) => c.id === first)?.inFrame, 30);
  assert.equal(p.clips.find((c) => c.track === "voice")?.startFrame, 60);
  assert.equal(sequenceDuration(p), 14);
  p = editSequence(p, { type: "undo" });
  assert.equal(p.settings.fps, 24);
  p = editSequence(p, { type: "redo" });
  assert.equal(p.settings.fps, 30);
});
test("audio shares the timebase and cannot overlap its own lane", () => {
  let p = editSequence(fixture(), {
    type: "insert",
    assetId: "b",
    track: "music",
  });
  assert.throws(() =>
    editSequence(p, {
      type: "insert",
      assetId: "b",
      track: "music",
      startFrame: 24,
    }),
  );
  p = editSequence(p, {
    type: "insert",
    assetId: "b",
    track: "voice",
    startFrame: 48,
  });
  assert.equal(sequenceDuration(p), 10);
  assert.throws(() =>
    editSequence(p, { type: "settings", settings: { fps: 0 as 24 } }),
  );
  assert.throws(() =>
    editSequence(p, { type: "insert", assetId: "b", track: "video" }),
  );
});

test("fps changes keep complete short sources bounded", () => {
  const source = fixture();
  source.settings.fps = 30;
  source.assets[0].duration = 31 / 30;
  const inserted = editSequence(source, { type: "insert", assetId: "a" });
  const converted = editSequence(inserted, {
    type: "settings",
    settings: { fps: 24 },
  });
  assert.equal(converted.clips[0].outFrame, 24);
  assert.equal(converted.clips[0].inFrame, 0);
  assert.equal(inserted.clips[0].outFrame, 31);
});
test("fps changes preserve contiguous audio lanes", () => {
  let audio = editSequence(fixture(), {
    type: "insert",
    assetId: "b",
    track: "voice",
  });
  audio = editSequence(audio, {
    type: "trim",
    clipId: audio.clips[0].id,
    inFrame: 1,
    outFrame: 26,
  });
  audio = editSequence(audio, {
    type: "insert",
    assetId: "b",
    track: "voice",
    startFrame: 25,
  });
  const changed = editSequence(audio, {
    type: "settings",
    settings: { fps: 30 },
  });
  assert.equal(
    changed.clips[1].startFrame,
    changed.clips[0].outFrame - changed.clips[0].inFrame,
  );
  assert.equal(changed.settings.fps, 30);
});
