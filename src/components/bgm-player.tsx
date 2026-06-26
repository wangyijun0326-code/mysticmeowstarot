import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

// Background pad volume — kept low so it never competes with the experience.
const DEFAULT_VOLUME = 0.15;

// Single curated track: Celtic ethereal drone (tin whistle + harp) mixed with
// fireside ambience (candle crackle, a struck match, soft breeze, rustling
// leaves) and the occasional gentle cat meow for the cat-tarot mood.
const TRACK_SRC = "/assets/bgm-celtic.mp3";

const STORAGE_KEY = "mm-bgm-muted";

/**
 * Global background-music player.
 *
 * - Seamless loop (the audio asset is a loopable ambient pad).
 * - Single mute / unmute toggle in the top-right corner.
 * - Default volume is intentionally low (0.15) so it acts as a subtle pad.
 *
 * Browsers block autoplay with sound until the user interacts with the page,
 * so playback starts muted-by-intent: the first user gesture (the toggle)
 * reliably starts audible sound.
 */
export function BgmPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(true);

  // Create the audio element once.
  useEffect(() => {
    const audio = new Audio(TRACK_SRC);
    audio.loop = true;
    audio.volume = DEFAULT_VOLUME;
    audio.preload = "auto";
    audioRef.current = audio;
    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = !muted;
    setMuted(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    }
    if (next) {
      audio.pause();
    } else {
      audio.volume = DEFAULT_VOLUME;
      void audio.play().catch(() => {
        /* ignored — user can retap if the browser blocks it */
      });
    }
  };

  return (
    <div className="sm-bgm">
      <button
        type="button"
        onClick={toggle}
        data-gesture
        aria-label={muted ? "开启背景音乐" : "静音背景音乐"}
        aria-pressed={!muted}
        className="sm-bgm-toggle"
      >
        {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
      </button>
    </div>
  );
}
