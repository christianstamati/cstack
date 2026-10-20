// The background loop. Browsers only start audio after a user gesture, so nothing
// plays until `start` is called from the entry screen's click.
import { useCallback, useEffect, useRef, useState } from "react";

import { browserStorage, readMuted, writeMuted } from "./logic.ts";

const MUSIC_URL = "./music/lofi-loop.mp3";
const VOLUME = 0.5;

export interface Music {
  muted: boolean;
  start: () => void;
  toggleMute: () => void;
}

export function useMusic(): Music {
  const [muted, setMuted] = useState(() => readMuted(browserStorage()));
  const audio = useRef<HTMLAudioElement | null>(null);
  const started = useRef(false);

  const play = useCallback(() => {
    audio.current ??= Object.assign(new Audio(MUSIC_URL), { loop: true, volume: VOLUME });
    audio.current.play().catch(() => {
      // Blocked or unsupported: the town works without music.
    });
  }, []);

  const start = useCallback(() => {
    started.current = true;
    if (!muted) play();
  }, [muted, play]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    setMuted(next);
    writeMuted(browserStorage(), next);
    if (next) audio.current?.pause();
    else if (started.current) play();
  }, [muted, play]);

  useEffect(() => () => audio.current?.pause(), []);

  return { muted, start, toggleMute };
}
