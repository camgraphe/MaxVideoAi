import test from "node:test";
import assert from "node:assert/strict";
import {
  synchronizeTimelineAudio,
  synchronizeTimelineVideo,
} from "../client/mediaPlayback";
import { fixture } from "./fixtures";
test("narration pauses with the buffering video clock and resumes at the source trim", () => {
  const p = fixture(),
    clip = {
      id: "voice",
      assetId: "b",
      track: "voice" as const,
      inFrame: 24,
      outFrame: 144,
      startFrame: 48,
      volume: 0.6,
    };
  const el = {
    readyState: 4,
    currentTime: 0,
    volume: 1,
    paused: true,
    play: async function () {
      this.paused = false;
    },
    pause: function () {
      this.paused = true;
    },
  };
  const playback = { time: 3, playing: true, buffering: false };
  synchronizeTimelineAudio(el, p, clip, playback);
  assert.equal(el.currentTime, 2);
  assert.equal(el.paused, false);
  assert.equal(el.volume, 0.6);
  playback.buffering = true;
  synchronizeTimelineAudio(el, p, clip, playback);
  assert.equal(el.paused, true, "Narration must pause while the video waits");
  assert.equal(el.currentTime, 2);
  playback.buffering = false;
  synchronizeTimelineAudio(el, p, clip, playback);
  assert.equal(el.paused, false);
  assert.equal(el.currentTime, 2);
  playback.time = 0;
  synchronizeTimelineAudio(el, p, clip, playback);
  assert.equal(
    el.paused,
    true,
    "Audio before its timeline start must stay paused",
  );
});

test("paused trimming follows a single source frame at either edge and never plays the media", () => {
  const p = fixture(),
    c = {
      id: "video",
      assetId: "a",
      track: "video" as const,
      inFrame: 0,
      outFrame: 240,
      startFrame: 0,
      volume: 1,
    };
  p.clips = [c];
  const el = {
    readyState: 4,
    currentTime: 0,
    volume: 1,
    paused: true,
    play: async function () {
      this.paused = false;
    },
    pause: function () {
      this.paused = true;
    },
  };
  const startCut = { ...c, inFrame: 1 };
  p.clips = [startCut];
  synchronizeTimelineVideo(el, p, startCut, 0, false);
  assert.equal(
    el.currentTime,
    1 / 24,
    "A one-frame start trim must update the decoded source position",
  );
  el.currentTime = 239 / 24;
  const endCut = { ...c, outFrame: 239 };
  p.clips = [endCut];
  synchronizeTimelineVideo(el, p, endCut, 238 / 24, false);
  assert.equal(
    el.currentTime,
    238 / 24,
    "A one-frame end trim must update the decoded source position",
  );
  assert.equal(el.paused, true);
});
