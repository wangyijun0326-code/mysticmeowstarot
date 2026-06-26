import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, Music } from "lucide-react";

// Background pad volume — kept low so it never competes with the experience.
const DEFAULT_VOLUME = 0.15;

type Track = { id: string; label: string; src: string };

const TRACKS: Track[] = [
  { id: "gothic", label: "暗黑神秘 · 哥特 Pad", src: "/assets/bgm.mp3" },
  { id: "celtic", label: "凯尔特空灵 · 纯净", src: "/assets/bgm-celtic.mp3" },
  { id: "ambient", label: "凯尔特空灵 + 烛火微风", src: "/assets/bgm-ambient.mp3" },
  { id: "nature", label: "自然白噪 · 风与树林", src: "/assets/bgm-nature.mp3" },
];

const STORAGE_KEY = "mm-bgm-track";

/**
 * Global background-music player.
 *
 * - Seamless loop (each audio asset is a loopable ambient pad).
 * - Mute / unmute toggle plus a track picker in the top-right corner.
 * - Default volume is intentionally low (0.15) so it acts as a subtle pad.
 *
 * Browsers block autoplay with sound until the user interacts with the page,
 * so playback starts muted-by-intent: the first user gesture (the toggle or
 * picking a track) reliably starts audible sound.
 */
export function BgmPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(true);
  const [open, setOpen] = useState(false);
  const [trackId, setTrackId] = useState<string>(() => {
    if (typeof window === "undefined") return TRACKS[0].id;
    return window.localStorage.getItem(STORAGE_KEY) ?? TRACKS[0].id;
  });

  const track = TRACKS.find((t) => t.id === trackId) ?? TRACKS[0];

  // Create the audio element once.
  useEffect(() => {
    const audio = new Audio(track.src);
    audio.loop = true;
    audio.volume = DEFAULT_VOLUME;
    audio.preload = "auto";
    audioRef.current = audio;
    return () => {
      audio.pause();
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = !muted;
    setMuted(next);
    if (next) {
      audio.pause();
    } else {
      audio.volume = DEFAULT_VOLUME;
      void audio.play().catch(() => {
        /* ignored — user can retap if the browser blocks it */
      });
    }
  };

  const selectTrack = (id: string) => {
    const t = TRACKS.find((x) => x.id === id);
    const audio = audioRef.current;
    if (!t || !audio) return;
    setTrackId(id);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, id);
    const wasPlaying = !muted;
    audio.pause();
    audio.src = t.src;
    audio.load();
    // Switching a track is an explicit gesture: start playing it audibly.
    setMuted(false);
    audio.volume = DEFAULT_VOLUME;
    void audio.play().catch(() => {
      if (!wasPlaying) setMuted(true);
    });
  };

  return (
    <div className="sm-bgm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-gesture
        aria-label="选择背景音乐"
        aria-expanded={open}
        className="sm-bgm-toggle"
      >
        <Music className="size-5" />
      </button>
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

      {open && (
        <div className="sm-bgm-menu" role="menu">
          {TRACKS.map((t) => (
            <button
              key={t.id}
              type="button"
              data-gesture
              role="menuitemradio"
              aria-checked={t.id === trackId}
              onClick={() => selectTrack(t.id)}
              className={`sm-bgm-item${t.id === trackId ? " is-active" : ""}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
