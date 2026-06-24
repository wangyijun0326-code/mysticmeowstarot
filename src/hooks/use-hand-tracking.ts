import { useCallback, useEffect, useRef, useState } from "react";

export type HandCursor = {
  /** Normalised 0..1 position of the index fingertip, already mirrored for a selfie view. */
  x: number;
  y: number;
  /** Whether a hand is currently detected. */
  active: boolean;
  /** Whether the thumb + index tips are pinched together. */
  pinch: boolean;
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

const IDLE_CURSOR: HandCursor = { x: 0.5, y: 0.5, active: false, pinch: false };

/**
 * Streams the webcam, runs MediaPipe HandLandmarker and exposes the index
 * fingertip as a normalised virtual cursor plus a pinch flag. The cursor is
 * published through a ref (updated every video frame) so consumers can drive a
 * requestAnimationFrame loop without forcing a React re-render each frame.
 */
export function useHandTracking(enabled: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<HandTrackingStatus>("idle");
  const cursorRef = useRef<HandCursor>({ ...IDLE_CURSOR });

  const rafRef = useRef<number | null>(null);
  const landmarkerRef = useRef<unknown>(null);
  const streamRef = useRef<MediaStream | null>(null);

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
      cursorRef.current = { ...IDLE_CURSOR };
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
              const tip = hand[8]; // index fingertip
              const thumb = hand[4]; // thumb tip
              const dx = (thumb?.x ?? tip.x) - tip.x;
              const dy = (thumb?.y ?? tip.y) - tip.y;
              const pinchDist = Math.hypot(dx, dy);
              cursorRef.current = {
                // Mirror X so it tracks like a mirror.
                x: 1 - tip.x,
                y: tip.y,
                active: true,
                pinch: pinchDist < 0.06,
              };
            } else if (cursorRef.current.active) {
              cursorRef.current = { ...cursorRef.current, active: false, pinch: false };
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

  return { videoRef, status, cursorRef };
}
