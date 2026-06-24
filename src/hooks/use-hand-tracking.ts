import { useCallback, useEffect, useRef, useState } from "react";

export type HandCursor = {
  /** Normalised 0..1 position of the index fingertip, already mirrored for a selfie view. */
  x: number;
  y: number;
  /** Whether a hand is currently detected. */
  active: boolean;
};

export type HandTrackingStatus =
  | "idle"
  | "requesting"
  | "loading"
  | "tracking"
  | "denied"
  | "error";

const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

/**
 * Streams the webcam, runs MediaPipe HandLandmarker and exposes the index
 * fingertip as a normalised virtual cursor. Mirrored so it feels like a mirror.
 */
export function useHandTracking(enabled: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<HandTrackingStatus>("idle");
  const [cursor, setCursor] = useState<HandCursor>({ x: 0.5, y: 0.5, active: false });

  const rafRef = useRef<number | null>(null);
  const landmarkerRef = useRef<unknown>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cursorRef = useRef<HandCursor>(cursor);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const landmarker = landmarkerRef.current as { close?: () => void } | null;
    landmarker?.close?.();
    landmarkerRef.current = null;
  }, []);

  useEffect(() => {
    if (!enabled) {
      stop();
      setStatus("idle");
      setCursor({ x: 0.5, y: 0.5, active: false });
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        setStatus("requesting");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 640, height: 480 },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }

        setStatus("loading");
        const vision = await import("@mediapipe/tasks-vision");
        const fileset = await vision.FilesetResolver.forVisionTasks(WASM_BASE);
        const landmarker = await vision.HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numHands: 1,
        });
        if (cancelled) {
          landmarker.close();
          return;
        }
        landmarkerRef.current = landmarker;
        setStatus("tracking");

        let lastVideoTime = -1;
        const loop = () => {
          const v = videoRef.current;
          const lm = landmarkerRef.current as
            | (typeof landmarker & { detectForVideo: typeof landmarker.detectForVideo })
            | null;
          if (v && lm && v.readyState >= 2 && v.currentTime !== lastVideoTime) {
            lastVideoTime = v.currentTime;
            const result = lm.detectForVideo(v, performance.now());
            const hand = result.landmarks?.[0];
            if (hand && hand[8]) {
              // Landmark 8 = index fingertip. Mirror X for selfie view.
              const next: HandCursor = {
                x: 1 - hand[8].x,
                y: hand[8].y,
                active: true,
              };
              cursorRef.current = next;
              setCursor(next);
            } else if (cursorRef.current.active) {
              const next = { ...cursorRef.current, active: false };
              cursorRef.current = next;
              setCursor(next);
            }
          }
          rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
      } catch (error) {
        if (cancelled) return;
        const name = (error as DOMException)?.name;
        setStatus(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "error");
      }
    };

    run();

    return () => {
      cancelled = true;
      stop();
    };
  }, [enabled, stop]);

  return { videoRef, status, cursor };
}
