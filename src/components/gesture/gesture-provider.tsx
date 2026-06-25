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

/** Unified pointer in absolute viewport pixels, merging mouse + pinch. */
export type UnifiedPointer = {
  /** Absolute viewport pixel coordinates (1:1 with getBoundingClientRect). */
  x: number;
  y: number;
  /** True while the mouse button is held OR the hand is pinching. */
  down: boolean;
  /** Which device currently owns the pointer. */
  source: "mouse" | "hand" | null;
  /** Whether a hand is being tracked right now. */
  handActive: boolean;
};

type GestureContextValue = {
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  toggle: () => void;
  status: HandTrackingStatus;
  /** Live cursor (normalised 0..1 viewport coords). Read in a rAF loop. */
  cursorRef: RefObject<HandCursor>;
  /** Live unified pointer in viewport pixels. Read in a rAF loop; never re-renders. */
  pointerRef: RefObject<UnifiedPointer>;
};

const GestureContext = createContext<GestureContextValue | null>(null);

export function useGesture() {
  const ctx = useContext(GestureContext);
  if (!ctx) throw new Error("useGesture must be used within <GestureProvider>");
  return ctx;
}

const DWELL_MS = 600;
const EDGE_BACK_ZONE = 0.14; // start within left 14% of the viewport
const EDGE_BACK_DX = 0.24; // must travel right at least this fraction
const EDGE_BACK_MS = 520;
// Buttons only — card selection is handled locally, never by the global engine.
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
  const [enabled, setEnabled] = useState(false);
  const [status, setStatusState] = useState<HandTrackingStatus>("idle");
  const { videoRef, status: trackStatus, cursorRef } = useHandTracking(enabled);

  const cursorElRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLSpanElement | null>(null);

  // Merged mouse state, kept in viewport pixels.
  const mouseRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2, down: false });
  // The unified pointer consumers read every frame.
  const pointerRef = useRef<UnifiedPointer>({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    down: false,
    source: null,
    handActive: false,
  });

  useEffect(() => setStatusState(trackStatus), [trackStatus]);

  const toggle = useCallback(() => setEnabled((v) => !v), []);

  // Kick off gesture tracking on first client mount.
  useEffect(() => {
    setEnabled(true);
  }, []);

  // Track the real mouse so the unified pointer also works without a camera.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    };
    const onDown = (e: PointerEvent) => {
      if (e.button === 0) mouseRef.current.down = true;
    };
    const onUp = (e: PointerEvent) => {
      if (e.button === 0) mouseRef.current.down = false;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  // Global interaction engine: virtual cursor + dwell/pinch click + edge-back + unified pointer.
  useEffect(() => {
    let raf = 0;
    let dwellTarget: HTMLElement | null = null;
    let dwellStart = 0;
    let fired = false;
    let pinchPrev = false;
    const edgeBuf: Array<{ x: number; y: number; t: number }> = [];
    let edgeCooldown = 0;

    const fire = (el: HTMLElement) => {
      el.click();
      el.classList.add("gesture-pulse");
      window.setTimeout(() => el.classList.remove("gesture-pulse"), 320);
    };

    const loop = () => {
      const W = window.innerWidth;
      const H = window.innerHeight;
      const c = cursorRef.current;
      const el = cursorElRef.current;
      const ring = ringRef.current;
      const now = performance.now();

      // ----- Merge mouse + hand into one viewport-pixel pointer -----
      if (c.active) {
        pointerRef.current.x = c.x * W;
        pointerRef.current.y = c.y * H;
        pointerRef.current.down = c.pinch;
        pointerRef.current.source = "hand";
      } else {
        pointerRef.current.x = mouseRef.current.x;
        pointerRef.current.y = mouseRef.current.y;
        pointerRef.current.down = mouseRef.current.down;
        pointerRef.current.source = "mouse";
      }
      pointerRef.current.handActive = c.active;

      if (el) {
        if (c.active) {
          const px = c.x * W;
          const py = c.y * H;
          el.style.transform = `translate(${px}px, ${py}px)`;
          el.style.opacity = "1";

          const target = clickableAt(px, py);
          el.classList.toggle("is-hot", Boolean(target));
          el.classList.toggle("is-pinch", c.pinch);

          // ----- Selection is PINCH-ONLY (hover/dwell auto-click removed) -----
          // Previously, hovering over a button for DWELL_MS (600ms) auto-fired a
          // click. That made buttons trigger just by hovering for under a second,
          // which is the "悬停就开始倒计时并自动确定" bug. We now require a
          // pinch (thumb + index) over the target to activate it.
          if (target !== dwellTarget) {
            // Reset the per-target latch when the cursor moves to a new target.
            dwellTarget = target;
            dwellStart = now;
            fired = false;
          }
          // The ring is now a pinch indicator only: it fills while pinching over
          // a clickable target, and never auto-fires on its own.
          if (ring) {
            ring.style.setProperty("--p", c.pinch && target ? "360deg" : "0deg");
          }

          // ----- Pinch to click a button -----
          if (c.pinch && !pinchPrev && target && !fired) {
            fire(target);
            fired = true;
          }
          pinchPrev = c.pinch;

          // ----- Edge swipe (left edge → history.back) -----
          edgeBuf.push({ x: c.x, y: c.y, t: now });
          while (edgeBuf.length && now - edgeBuf[0].t > EDGE_BACK_MS) edgeBuf.shift();
          if (now > edgeCooldown && edgeBuf.length > 3) {
            const start = edgeBuf[0];
            const end = edgeBuf[edgeBuf.length - 1];
            const dx = end.x - start.x;
            const dy = Math.abs(end.y - start.y);
            if (start.x < EDGE_BACK_ZONE && dx > EDGE_BACK_DX && dy < 0.18) {
              edgeCooldown = now + 1200;
              edgeBuf.length = 0;
              // Walk the in-app state machine back via a global event.
              window.dispatchEvent(new CustomEvent("gesture:back"));
            }
          }
        } else {
          el.style.opacity = "0";
          el.classList.remove("is-hot", "is-pinch");
          dwellTarget = null;
          fired = false;
          pinchPrev = false;
          edgeBuf.length = 0;
          if (ring) ring.style.setProperty("--p", "0deg");
        }
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [cursorRef]);

  return (
    <GestureContext.Provider
      value={{ enabled, setEnabled, toggle, status, cursorRef, pointerRef }}
    >
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
      return "手势已连接 · 捏合抓取，左缘右滑返回";
    case "denied":
      return "摄像头被拒绝，可用鼠标操作";
    case "error":
      return "手势不可用，可用鼠标操作";
    default:
      return "手势准备中……";
  }
}
