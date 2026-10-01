import { useEffect, useRef, useState } from "react";
export function usePlayback(duration: number) {
  const [time, setTime] = useState(0),
    [playing, setPlaying] = useState(false),
    [buffering, setBuffering] = useState(false),
    clock = useRef(0);
  useEffect(() => {
    if (time > duration) {
      setTime(duration);
      setPlaying(false);
    }
  }, [duration, time]);
  useEffect(() => {
    if (!playing || buffering) return;
    let frame = 0;
    clock.current = performance.now();
    const tick = (now: number) => {
      const delta = Math.min(0.1, (now - clock.current) / 1000);
      clock.current = now;
      setTime((t) => {
        if (t + delta >= duration) {
          setPlaying(false);
          return 0;
        }
        return t + delta;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, buffering, duration]);
  return {
    time,
    playing,
    buffering,
    setBuffering,
    seek: (t: number) => setTime(Math.max(0, Math.min(duration, t))),
    setPlaying,
    toggle: () => setPlaying((p) => !p),
  };
}
export type Playback = ReturnType<typeof usePlayback>;
