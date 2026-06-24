import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import {
  useHandTracking,
  type HandCursor,
  type HandTrackingStatus,
} from "@/hooks/use-hand-tracking";

type GestureContextValue = {
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  toggle: () => void;
  status: HandTrackingStatus;
  /** Live cursor (normalised 0..1 viewport coords). Read in a rAF loop; never re-renders. */
  cursorRef: RefObject<HandCursor>;
};

const GestureContext = createContext<GestureContextValue | null>(null);

export function useGesture() {
  const ctx = useContext(GestureContext);
  if (!ctx) throw new Error("useGesture must be used within <GestureProvider>");
  return ctx;
}

const DWELL_MS = 600;
const SWIPE_DX = 0.32; // normalised horizontal travel
const SWIPE_MS = 420;
const CLICKABLE = 'button, a[href], [role="button"], [data-gesture]';

function clickableAt(x: number, y: number): HTMLElement | null {
  let el = document.elementFromPoint(x, y) as HTMLElement | null;
  for (let i = 0; el && i < 8; i += 1) {
    if (
      typeof el.matches === "function" &&
      el.matches(CLICKABLE) &&
      !el.hasAttribute("data-gesture-ignore") &&
      !(el as HTMLButtonElement).disabled
    ) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

export function GestureProvider({ children }: { children: ReactNode }) {
  // Auto-request the camera as soon as the app mounts on the client.
  const [enabled, setEnabled] = useState(false);
  const [status, setStatusState] = useState<HandTrackingStatus>("idle");
  const { videoRef, status: trackStatus, cursorRef } = useHandTracking(enabled);

  const cursorElRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => setStatusState(trackStatus), [trackStatus]);

  const toggle = useCallback(() => setEnabled((v) => !v), []);

  // Kick off gesture tracking on first client mount.
  useEffect(() => {
    setEnabled(true);
  }, []);

  // Global interaction engine: drives the virtual cursor + dwell / pinch / swipe.
  useEffect(() => {
    let raf = 0;
    let dwellTarget: HTMLElement | null = null;
    let dwellStart = 0;
    let fired = false;
    let pinchPrev = false;
    const swipeBuf: Array<{ x: number; t: number }> = [];
    let swipeCooldown = 0;

    const fire = (el: HTMLElement) => {
      el.click();
      el.classList.add("gesture-pulse");
      window.setTimeout(() => el.classList.remove("gesture-pulse"), 320);
    };

    const loop = () => {
      const c = cursorRef.current;
      const el = cursorElRef.current;
      const ring = ringRef.current;
      if (el) {
        if (c.active) {
          const px = c.x * window.innerWidth;
          const py = c.y * window.innerHeight;
          el.style.transform = `translate(${px}px, ${py}px)`;
          el.style.opacity = "1";

          const target = clickableAt(px, py);
          el.classList.toggle("is-hot", Boolean(target));
          el.classList.toggle("is-pinch", c.pinch);

          const now = performance.now();

          // ----- Dwell to click -----
          if (target && target === dwellTarget) {
            if (!fired) {
              const p = Math.min(1, (now - dwellStart) / DWELL_MS);
              if (ring) ring.style.setProperty("--p", `${p * 360}deg`);
              if (p >= 1) {
                fire(target);
                fired = true;
              }
            }
          } else {
            dwellTarget = target;
            dwellStart = now;
            fired = false;
            if (ring) ring.style.setProperty("--p", "0deg");
          }

          // ----- Pinch to click (fires once on transition) -----
          if (c.pinch && !pinchPrev && target && !fired) {
            fire(target);
            fired = true;
          }
          pinchPrev = c.pinch;

          // ----- Swipe (horizontal) for elements opting in -----
          swipeBuf.push({ x: c.x, t: now });
          while (swipeBuf.length && now - swipeBuf[0].t > SWIPE_MS) swipeBuf.shift();
          if (now > swipeCooldown && swipeBuf.length > 3) {
            const dx = swipeBuf[swipeBuf.length - 1].x - swipeBuf[0].x;
            if (Math.abs(dx) > SWIPE_DX) {
              let swipeEl = document.elementFromPoint(px, py) as HTMLElement | null;
              for (let i = 0; swipeEl && i < 8; i += 1) {
                if (swipeEl.hasAttribute?.("data-gesture-swipe")) {
                  fire(swipeEl);
                  swipeCooldown = now + 900;
                  swipeBuf.length = 0;
                  break;
                }
                swipeEl = swipeEl.parentElement;
              }
            }
          }
        } else {
          el.style.opacity = "0";
          el.classList.remove("is-hot", "is-pinch");
          dwellTarget = null;
          fired = false;
          pinchPrev = false;
          swipeBuf.length = 0;
          if (ring) ring.style.setProperty("--p", "0deg");
        }
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [cursorRef]);

  return (
    <GestureContext.Provider value={{ enabled, setEnabled, toggle, status, cursorRef }}>
      {children}

      {/* Global gesture overlay — covers the whole viewport, ignores pointer events. */}
      <div className="gesture-overlay" aria-hidden="true">
        <div ref={cursorElRef} className="gesture-cursor">
          <span className="gesture-cursor-dot" />
          <span ref={ringRef} className="gesture-cursor-ring" />
        </div>
      </div>

      {/* Tiny corner camera preview + control. Interactive (pointer-events auto). */}
      <div className="gesture-hud">
        <video
          ref={videoRef}
          className={`gesture-cam${enabled ? "" : " is-off"}`}
          playsInline
          muted
        />
        <button type="button" className="gesture-toggle" onClick={toggle} data-gesture-ignore>
          {enabled ? "关闭手势" : "开启手势"}
        </button>
        <p className="gesture-status">{statusLabel(enabled, status)}</p>
      </div>
    </GestureContext.Provider>
  );
}

function statusLabel(enabled: boolean, status: HandTrackingStatus) {
  if (!enabled) return "手势已关闭";
  switch (status) {
    case "requesting":
      return "正在请求摄像头……";
    case "loading":
      return "正在载入手势模型……";
    case "tracking":
      return "手势已连接 · 悬停或捏合即点击";
    case "denied":
      return "摄像头被拒绝，可用鼠标操作";
    case "error":
      return "手势不可用，可用鼠标操作";
    default:
      return "手势准备中……";
  }
}
