import { createFileRoute } from "@tanstack/react-router";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChevronLeft, RotateCcw, X } from "lucide-react";
import {
  SPREADS,
  SPREAD_ASSETS,
  createSessionDeck,
  getCardFrontPath,
  type DrawnCard,
  type SpreadId,
} from "@/lib/tarot";
import { generateTarotReading } from "@/lib/tarot-reading.functions";
import { useGesture } from "@/components/gesture/gesture-provider";
import { useSlotLayout } from "@/lib/slot-layout";

import { useHotspotLayout } from "@/lib/hotspot-layout";
import { useGlow } from "@/lib/candle-glow";
import { usePileGlow, usePileGlowPreview } from "@/lib/pile-glow";
import { CandleGlowDebugger } from "@/components/candle-glow-debugger";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "猫咪塔罗 Web App" },
      {
        name: "description",
        content: "沉浸式猫咪塔罗抽牌体验，含手势物理洗牌、捏合选牌与 AI 中性深度解读。",
      },
      { property: "og:title", content: "猫咪塔罗 Web App" },
      {
        property: "og:description",
        content: "沉浸式猫咪塔罗抽牌体验，含手势物理洗牌、捏合选牌与 AI 中性深度解读。",
      },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Index,
});

/**
 * Universal application state machine — identical for One / Three / Five card
 * spreads. Each phase binds to a design screenshot resolved dynamically from
 * the active spread (see baseImage below).
 *
 *   MENU → SPREAD_SELECTION → SHUFFLE → DRAWING → REVERSAL → END
 *
 *   The old SUCCESS transition page has been removed; once every required slot
 *   is filled the app advances directly to the reveal phase.
 */
type GameState =
  | "MENU"
  | "SPREAD_SELECTION"
  | "SHUFFLE"
  | "DRAWING"
  | "REVERSAL"
  | "END";

type SessionDeckCard = ReturnType<typeof createSessionDeck>[number];

const BACK_SRC = "/assets/back.png";
const assetUrl = (file: string) => `/assets/${file}`;
const spring = { type: "spring", stiffness: 200, damping: 24, mass: 0.8 } as const;

/** Draggable, dismissable semi-transparent gesture guide popup. */
function GestureGuideToast({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      className="sm-guide-toast"
      drag
      dragMomentum={false}
      dragElastic={0.08}
      whileDrag={{ scale: 1.02, cursor: "grabbing" }}
      initial={{ opacity: 0, y: -20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.96 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <div className="sm-guide-toast__dragbar" aria-hidden="true">
        <span className="sm-guide-toast__dragdots" />
      </div>
      <button
        type="button"
        className="sm-guide-toast__close"
        onClick={onClose}
        aria-label="关闭手势指南"
        data-gesture-ignore
        onPointerDown={(e) => e.stopPropagation()}
      >
        <X className="size-4" />
      </button>
      <div className="sm-guide-toast__header">
        <span className="sm-guide-toast__paw">🐾</span>
        <h3 className="sm-guide-toast__title">喵爪手势指南</h3>
      </div>
      <p className="sm-guide-toast__body">
        恭喜解锁“隔空抽牌”魔法！动作慢一点更灵验哦：
        <br />
        张手悬停或滑屏来查看卡牌，对准目标握拳即可选定。
      </p>
      <p className="sm-guide-toast__tip">
        抓牌小贴士：如果喵爪感应累了，随时欢迎召唤鼠标特工来帮忙（尤其在洗牌页面，用鼠标更省力呢）~
      </p>
    </motion.div>
  );
}

function Index() {
  const [gameState, setGameState] = useState<GameState>("MENU");
  const [spreadId, setSpreadId] = useState<SpreadId | null>(null);
  const [deck, setDeck] = useState<SessionDeckCard[]>(() => createSessionDeck());
  const [drawnCards, setDrawnCards] = useState<DrawnCard[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Synchronous mirror of selectedIds. State updaters can run twice under React
  // StrictMode; the previous code called setDrawnCards INSIDE the setSelectedIds
  // updater, so one pick added two cards (the "选了一张却变两张 / 6/5" bug).
  // A ref lets drawCard guard and commit exactly once per gesture.
  const selectedRef = useRef<string[]>([]);
  const [reading, setReading] = useState<
    { summary: string; perCard: Array<{ position: string; title: string; text: string }> } | null
  >(null);
  const [isLoadingReading, setIsLoadingReading] = useState(false);
  const [showGestureGuide, setShowGestureGuide] = useState(false);
  const [readingError, setReadingError] = useState<string | null>(null);
  const readingRequested = useRef(false);

  const spread = spreadId ? SPREADS[spreadId] : null;
  const requiredCount = spread?.positions.length ?? 0;
  // Use >= (not ===) so that even if an extra card slips in, the draw still
  // completes and advances. The strict === check was the root cause of the
  // "6/5 然后卡住不跳转" bug: one accidental double-pick pushed the count past
  // the required number, and === never matched again.
  const isDrawComplete = requiredCount > 0 && drawnCards.length >= requiredCount;

  const railDeck = useMemo(
    () => deck.filter((card) => !selectedIds.includes(card.instanceId)),
    [deck, selectedIds],
  );

  // Dynamic asset mapping — the same logic resolves the right screenshot for
  // every spread type (one / three / five) and every phase.
  const baseImage = useMemo(() => {
    if (gameState === "MENU") return assetUrl("menu.png");
    if (gameState === "SPREAD_SELECTION") return assetUrl("spreads.png");
    if (gameState === "SHUFFLE") return assetUrl("wash.png");
    if (!spreadId) return null;
    const a = SPREAD_ASSETS[spreadId];
    // DRAWING now renders the user's own design screenshot (one/three/five
    // cards) as the base, with live interactive cards layered on top — instead
    // of a separate custom layout that ignored the design.
    if (gameState === "DRAWING") return assetUrl(a.draw);
    if (gameState === "REVERSAL") return assetUrl(a.reversal);
    if (gameState === "END") return assetUrl(a.end);
    return null;
  }, [gameState, spreadId]);

  // ---- AI reading: requested once, when we enter the END phase ----
  const runReading = useCallback(async () => {
    if (!spread || readingRequested.current) return;
    readingRequested.current = true;
    setIsLoadingReading(true);
    setReadingError(null);
    try {
      const response = await generateTarotReading({
        data: {
          spread: `${spread.title}（${spread.subtitle}）`,
          cards: drawnCards.map((c) => ({ position: c.position, name: c.name, state: c.state })),
        },
      });
      setReading(response);
    } catch (error) {
      console.error("Tarot reading generation failed:", error);
      setReadingError("解读暂时无法生成，先看看你抽到的牌吧。");
    } finally {
      setIsLoadingReading(false);
    }
  }, [spread, drawnCards]);

  // Phase 3 trigger: once every required slot is filled → REVERSAL.
  useEffect(() => {
    if (gameState === "DRAWING" && isDrawComplete) setGameState("REVERSAL");
  }, [gameState, isDrawComplete]);

  // REVERSAL → END (kick off the reading on entry).
  const goToEnd = useCallback(() => {
    setGameState("END");
    void runReading();
  }, [runReading]);

  const chooseSpread = (next: SpreadId) => {
    setSpreadId(next);
    setDeck(createSessionDeck());
    selectedRef.current = [];
    setSelectedIds([]);
    setDrawnCards([]);
    setReading(null);
    setReadingError(null);
    readingRequested.current = false;
    setGameState("SHUFFLE");
  };

  const finishShuffle = useCallback(() => {
    setDeck(createSessionDeck());
    setGameState("DRAWING");
  }, []);

  const drawCard = useCallback(
    (card: SessionDeckCard) => {
      if (!spread) return;
      const current = selectedRef.current;
      // Idempotent + capped: a card is never added twice, and the count can
      // never exceed the spread size — no matter how many times this fires.
      if (current.includes(card.instanceId)) return;
      if (current.length >= spread.positions.length) return;
      const nextIndex = current.length;
      const next = [...current, card.instanceId];
      selectedRef.current = next;
      setSelectedIds(next);
      setDrawnCards((c) => [
        ...c,
        {
          number: card.number,
          name: card.name,
          state: card.state,
          position: spread.positions[nextIndex],
          slotIndex: nextIndex,
        },
      ]);
    },
    [spread],
  );

  const resetAll = useCallback(() => {
    setSpreadId(null);
    setDeck(createSessionDeck());
    selectedRef.current = [];
    setSelectedIds([]);
    setDrawnCards([]);
    setReading(null);
    setReadingError(null);
    setIsLoadingReading(false);
    readingRequested.current = false;
    setGameState("MENU");
  }, []);

  // ---- Global back: walks one step backwards through the state machine ----
  const goBack = useCallback(() => {
    setGameState((current) => {
      switch (current) {
        case "SPREAD_SELECTION":
          return "MENU";
        case "SHUFFLE":
          return "SPREAD_SELECTION";
        case "DRAWING":
        case "REVERSAL":
          selectedRef.current = [];
          setSelectedIds([]);
          setDrawnCards([]);
          return "SHUFFLE";
        default:
          return current;
      }
    });
  }, []);

  // Edge-swipe (left → right) from the global gesture layer triggers back.
  useEffect(() => {
    const handler = () => goBack();
    window.addEventListener("gesture:back", handler as EventListener);
    return () => window.removeEventListener("gesture:back", handler as EventListener);
  }, [goBack]);

  // Only auto-open the gesture guide on desktop (mouse) devices. On touch
  // devices the camera gesture isn't the primary input, so the large popup
  // would just cover the screen on first load. Read in an effect to avoid an
  // SSR/hydration mismatch.
  useEffect(() => {
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      setShowGestureGuide(true);
    }
  }, []);

  const showResult = gameState === "END";

  return (
    <div className="sm-root">
      {showGestureGuide && <GestureGuideToast onClose={() => setShowGestureGuide(false)} />}

      {gameState !== "MENU" && (
        <GlobalBackButton
          onBack={showResult ? resetAll : goBack}
          label={showResult ? "重新占卜" : "返回"}
        />
      )}

      <div className="sm-stage">
        {baseImage && (
          <img className="sm-base" src={baseImage} alt="" draggable={false} aria-hidden="true" />
        )}

        <HeaderHomeHotspots top={gameState === "MENU" ? "3.2%" : "1.4%"} onHome={resetAll} />

        <CandleGlow gameState={gameState} />

        <AnimatePresence>
          {gameState === "MENU" && (
            <MenuOverlay key="menu" onStart={() => setGameState("SPREAD_SELECTION")} />
          )}
          {gameState === "SPREAD_SELECTION" && (
            <SpreadOverlay key="spreads" onChoose={chooseSpread} />
          )}
          {gameState === "SHUFFLE" && <ShuffleStage key="shuffle" onDone={finishShuffle} />}
          {gameState === "DRAWING" && spreadId && (
            <DrawingStage
              key="drawing"
              spreadId={spreadId}
              drawnCards={drawnCards}
              railDeck={railDeck}
              onDraw={drawCard}
              locked={isDrawComplete}
            />
          )}
          {gameState === "REVERSAL" && spreadId && (
            <ReversalStage key="reversal" drawnCards={drawnCards} onRevealed={goToEnd} />
          )}
          {gameState === "END" && spread && spreadId && (
            <EndStage
              key="end"
              spread={spread}
              drawnCards={drawnCards}
              reading={reading}
              isLoading={isLoadingReading}
              error={readingError}
              onReset={resetAll}
            />
          )}
        </AnimatePresence>
      </div>

      {import.meta.env.DEV && <CandleGlowDebugger gameState={gameState} />}
    </div>
  );
}

/* ----------------------------------------------------- CANDLE FLAME GLOW */

/**
 * Flickering golden halo overlaid on top of the painted candle flame in each
 * background. Positions are expressed as percentages of the stage so they
 * track the candle artwork across viewport sizes. Pure-CSS flicker: the halo
 * loops between opacity 0.4 and 0.9 every 0.8s (see `.sm-candle-glow`).
 */
function CandleGlow({ gameState }: { gameState: GameState }) {
  const glow = useGlow();
  const spots = glow[gameState];
  if (!spots || spots.length === 0) return null;

  return (
    <div className="sm-layer sm-candle-glow-layer" aria-hidden="true">
      {spots.map((p, i) => (
        <span
          key={i}
          className="sm-candle-glow"
          style={{ left: `${p.x}%`, top: `${p.y}%`, animationDelay: `${i * 0.27}s` }}
        />
      ))}
    </div>
  );
}

/* ----------------------------------------------------------- GLOBAL BACK */

function GlobalBackButton({ onBack, label }: { onBack: () => void; label: string }) {
  return (
    <button type="button" className="sm-back" onClick={onBack} data-gesture aria-label={label}>
      <ChevronLeft className="size-5" />
      <span>{label}</span>
    </button>
  );
}

function HeaderHomeHotspots({ top, onHome }: { top: string; onHome: () => void }) {
  const items = [
    { label: "HOME", left: "14.8%", width: "9.2%" },
    { label: "ABOUT", left: "26.5%", width: "9.2%" },
    { label: "HISTORY", left: "63.2%", width: "10.0%" },
    { label: "CONTACT", left: "77.0%", width: "10.0%" },
  ] as const;

  return (
    <div className="sm-layer sm-nav-hotspots">
      {items.map((item) => (
        <HeaderNavButton
          key={item.label}
          label={item.label}
          left={item.left}
          top={top}
          width={item.width}
          height="7.5%"
          onClick={onHome}
        />
      ))}
    </div>
  );
}

function HeaderNavButton({
  label,
  left,
  top,
  width,
  height,
  onClick,
}: {
  label: string;
  left: string;
  top: string;
  width: string;
  height: string;
  onClick: () => void;
}) {
  const style = {
    left,
    top,
    width,
    height,
  } as CSSProperties;

  return (
    <button
      type="button"
      className="sm-nav-button"
      style={style}
      onClick={onClick}
      aria-label={`${label} 返回首页`}
    >
      <span className="sm-nav-button__label">{label}</span>
    </button>
  );
}


/* ------------------------------------------------------------------ MENU */

function MenuOverlay({ onStart }: { onStart: () => void }) {
  const layout = useHotspotLayout();
  return (
    <motion.div
      className="sm-layer"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {layout.menu.hotspots.map((h) => (
        <Hotspot
          key={h.id}
          label={h.label}
          left={`${h.left}%`}
          top={`${h.top}%`}
          width={`${h.width}%`}
          height={`${h.height}%`}
          className={h.id === "start" ? "is-menu-paw" : "is-menu-paw"}
          muted={h.id !== "start"}
          onClick={h.id === "start" ? onStart : () => undefined}
        />
      ))}
    </motion.div>
  );
}


/* -------------------------------------------------------- SPREAD SELECTION */

function SpreadOverlay({ onChoose }: { onChoose: (id: SpreadId) => void }) {
  const layout = useHotspotLayout();
  return (
    <motion.div
      className="sm-layer"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {layout.spreads.hotspots.map((h) => (
        <Hotspot
          key={h.id}
          label={h.label}
          left={`${h.left}%`}
          top={`${h.top}%`}
          width={`${h.width}%`}
          height={`${h.height}%`}
          className="is-spread-panel"
          rotate={h.rotate !== undefined ? `${h.rotate}deg` : "0deg"}
          onClick={() => onChoose(h.id as SpreadId)}
        />
      ))}
    </motion.div>
  );
}


/* -------------------------------------------------- SHUFFLE (physics pile) */

const PILE_SIZE = 30;

type CardPhys = {
  x: number;
  y: number;
  rot: number;
  vx: number;
  vy: number;
  vr: number;
  hx: number; // resting "neat pile" offset (px)
  hy: number;
  hrot: number;
};

function makePhys(): CardPhys[] {
  return Array.from({ length: PILE_SIZE }, () => {
    const hx = (Math.random() - 0.5) * 16;
    const hy = (Math.random() - 0.5) * 22;
    const hrot = (Math.random() - 0.5) * 10;
    return { x: hx, y: hy, rot: hrot, vx: 0, vy: 0, vr: 0, hx, hy, hrot };
  });
}

function ShuffleStage({ onDone }: { onDone: () => void }) {
  const { pointerRef } = useGesture();
  const layout = useHotspotLayout();
  const [shuffling, setShuffling] = useState(false);
  const doneRef = useRef(false);
  const pileRef = useRef<HTMLDivElement | null>(null);
  // Plain-number physics state shared with each ShuffleCard by index.
  const physRef = useRef<CardPhys[]>(makePhys());

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setShuffling(true);
    // One last energetic scatter so proceeding feels earned.
    for (const c of physRef.current) {
      const ang = Math.random() * Math.PI * 2;
      const r = 120 + Math.random() * 220;
      c.vx += Math.cos(ang) * r * 0.16;
      c.vy += Math.sin(ang) * r * 0.16;
      c.vr += (Math.random() - 0.5) * 60;
    }
    window.setTimeout(onDone, 1200);
  }, [onDone]);

  // Unified pointer (hand OR mouse) drives a real "hand-rub" scatter: cards
  // near the pointer are dragged ALONG its motion (so they follow your hand),
  // pushed outward (centrifugal "散开"), and tumble (spin). Circle ~3 turns to
  // auto-complete, or tap the design's 完成洗牌 button.
  useEffect(() => {
    let raf = 0;
    let prevX = 0;
    let prevY = 0;
    let prevAngle: number | null = null;
    let totalAngle = 0;
    let usedHand = false;
    let inited = false;


    const loop = () => {
      const p = pointerRef.current;
      const rect = pileRef.current?.getBoundingClientRect();
      const phys = physRef.current;
      if (rect) {
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const unit = rect.width; // pile width ≈ 12% of stage

        if (!inited) {
          prevX = p.x;
          prevY = p.y;
          inited = true;
        }
        const pvx = p.x - prevX;
        const pvy = p.y - prevY;
        prevX = p.x;
        prevY = p.y;

        const dxc = p.x - cx;
        const dyc = p.y - cy;
        const distToCenter = Math.hypot(dxc, dyc);
        const speed = Math.hypot(pvx, pvy);
        const isHand = p.handActive && !p.down;
        // The hand cursor is smoothed/slower than the mouse, so it needs a
        // lower speed gate and a wider engage radius to keep accumulating angle.
        const speedGate = isHand ? 0.2 : 0.6;
        const engaged =
          !doneRef.current &&
          (p.handActive || p.down) &&
          distToCenter < unit * (isHand ? 4.2 : 3.2) &&
          speed > speedGate;


        if (engaged) {
          if (isHand) usedHand = true;
          const ang = Math.atan2(dyc, dxc);
          if (prevAngle !== null) {
            let d = ang - prevAngle;
            if (d > Math.PI) d -= 2 * Math.PI;
            if (d < -Math.PI) d += 2 * Math.PI;
            totalAngle += Math.abs(d);
          }
          prevAngle = ang;
        } else {
          prevAngle = null;
        }


        for (const c of phys) {
          if (engaged) {
            const dx = cx + c.x - p.x;
            const dy = cy + c.y - p.y;
            const dist = Math.hypot(dx, dy) || 1;
            const reach = unit * 2.2;
            const influence = Math.max(0, 1 - dist / reach);
            if (influence > 0) {
              c.vx += pvx * influence * 0.9; // follow the hand
              c.vy += pvy * influence * 0.9;
              c.vx += (dx / dist) * influence * speed * 0.5; // push outward
              c.vy += (dy / dist) * influence * speed * 0.5;
              c.vr += (pvx * 0.12 + (Math.random() - 0.5) * 4) * influence; // tumble
            }
          }
          const k = engaged ? 0.006 : 0.04; // spring back to the neat pile
          c.vx += (c.hx - c.x) * k;
          c.vy += (c.hy - c.y) * k;
          c.vr += (c.hrot - c.rot) * (engaged ? 0.004 : 0.05);
          c.vx *= 0.86;
          c.vy *= 0.86;
          c.vr *= 0.9;
          c.x += c.vx;
          c.y += c.vy;
          c.rot += c.vr;
        }

        // Hand-only: ~1.5 turns is enough; mouse keeps the satisfying 3 turns.
        if (totalAngle > (usedHand ? Math.PI * 3 : Math.PI * 6)) finish();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [pointerRef, finish]);

  return (
    <motion.div
      className="sm-layer sm-shuffle"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="sm-pile" ref={pileRef}>
        {physRef.current.map((_, i) => (
          <ShuffleCard key={i} phys={physRef} index={i} />
        ))}
      </div>

      <PileGlow shuffling={shuffling} />



      {/* Transparent trigger sitting on the design's own painted 完成洗牌 button —
          no duplicate pill, no overlapping hint text. Fine-tune left/top/width/
          height in preview so it lands exactly on the painted button. */}
      <Hotspot
        label={layout.shuffle.hotspots[0]?.label ?? "完成洗牌"}
        left={`${layout.shuffle.hotspots[0]?.left ?? 50}%`}
        top={`${layout.shuffle.hotspots[0]?.top ?? 92}%`}
        width={`${layout.shuffle.hotspots[0]?.width ?? 14}%`}
        height={`${layout.shuffle.hotspots[0]?.height ?? 7}%`}
        onClick={finish}
      />
    </motion.div>
  );
}

/**
 * The warm "shuffle complete" gold flare. Position / size / colour depth come
 * from the persisted pile-glow store (editable via the 金光校准 tool). It blooms
 * once when a shuffle finishes, and renders statically while the calibration
 * panel is open so it can be aligned by eye.
 */
function PileGlow({ shuffling }: { shuffling: boolean }) {
  const cfg = usePileGlow();
  const preview = usePileGlowPreview();

  const baseStyle: CSSProperties = {
    left: `${cfg.x}%`,
    top: `${cfg.y}%`,
    width: `${cfg.size}%`,
    height: `${cfg.size}%`,
    ["--pile-glow-intensity" as string]: cfg.intensity,
  };

  if (preview) {
    return <div className="sm-pile-glow" style={{ ...baseStyle, opacity: cfg.intensity }} />;
  }

  return (
    <AnimatePresence>
      {shuffling && (
        <motion.div
          className="sm-pile-glow"
          style={baseStyle}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: [0, cfg.intensity, 0], scale: [0.7, 1.15, 1.4] }}
          transition={{ duration: 1.4, ease: "easeOut" }}
        />
      )}
    </AnimatePresence>
  );
}



function ShuffleCard({
  phys,
  index,
}: {
  phys: { current: CardPhys[] };
  index: number;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rot = useMotionValue(0);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const c = phys.current?.[index];
      if (c) {
        x.set(c.x);
        y.set(c.y);
        rot.set(c.rot);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phys, index, x, y, rot]);

  return (
    <motion.img
      src={BACK_SRC}
      alt=""
      draggable={false}
      className="sm-pile-card"
      style={{ x, y, rotate: rot, zIndex: index }}
    />
  );
}

/* ----------------------------------- DRAWING (pinch · drag · release) */

type DragPhase = "idle" | "pressing" | "dragging";

type Flight = {
  id: string;
  card: SessionDeckCard;
  slotIndex: number;
  cardW: number;
  cardH: number;
  fromX: number;
  fromY: number;
  midX: number;
  toX: number;
  toY: number;
  arcY: number;
  toScale: number;
};

const FLIGHT_MS = 900;

function DrawingStage({
  spreadId,
  drawnCards,
  railDeck,
  onDraw,
  locked,
}: {
  spreadId: SpreadId;
  drawnCards: DrawnCard[];
  railDeck: SessionDeckCard[];
  onDraw: (card: SessionDeckCard) => void;
  locked: boolean;
}) {
  const { pointerRef } = useGesture();
  const layout = useSlotLayout();
  const spreadLayout = layout[spreadId];
  const slots = spreadLayout.slots;

  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const slotRefs = useRef<Map<number, HTMLElement>>(new Map());
  const poolWrapRef = useRef<HTMLDivElement | null>(null);
  const poolRef = useRef<HTMLDivElement | null>(null);
  // Single controlled offset for the carousel — driven by BOTH mouse drag
  // (framer) and hand swipe, so the rail moves either way.
  const poolX = useMotionValue(0);

  // ---- Flight + golden-trail state -------------------------------------
  const [flights, setFlights] = useState<Flight[]>([]);
  const flightsRef = useRef<Flight[]>([]);
  flightsRef.current = flights;
  const [flashIndex, setFlashIndex] = useState<number | null>(null);
  const inFlightIdsRef = useRef<Set<string>>(new Set());
  const flightElRefs = useRef<Map<string, HTMLElement>>(new Map());
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawnCardsRef = useRef(drawnCards);
  drawnCardsRef.current = drawnCards;

  const railRef = useRef(railDeck);
  railRef.current = railDeck;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  // Suppresses a tap that is really the tail of a carousel drag.
  const draggingRef = useRef(false);

  const minPoolX = useCallback(() => {
    const track = poolRef.current;
    const wrap = poolWrapRef.current;
    if (!track || !wrap) return 0;
    return Math.min(0, wrap.clientWidth - track.scrollWidth);
  }, []);

  // Launch a chosen card on a bezier arc into the next empty slot, leaving a
  // golden particle trail. The card is only committed to the spread (onDraw)
  // once it lands, so the trail + slot landing flash read as "draw success".
  const launch = useCallback(
    (card: SessionDeckCard) => {
      if (lockedRef.current) return;
      if (inFlightIdsRef.current.has(card.instanceId)) return;
      const taken = drawnCardsRef.current.length + flightsRef.current.length;
      if (taken >= slots.length) return;

      const fromEl = cardRefs.current.get(card.instanceId);
      const slotIndex = taken;
      const slotEl = slotRefs.current.get(slotIndex);
      if (!fromEl || !slotEl) {
        onDraw(card);
        return;
      }

      const fr = fromEl.getBoundingClientRect();
      const tr = slotEl.getBoundingClientRect();
      const cardW = fr.width;
      const cardH = fr.height;
      const fromX = fr.left;
      const fromY = fr.top;
      const toX = tr.left + tr.width / 2 - cardW / 2;
      const toY = tr.top + tr.height / 2 - cardH / 2;
      const toScale = tr.width / cardW || 1;
      const midX = (fromX + toX) / 2;
      const dist = Math.hypot(toX - fromX, toY - fromY);
      const arcY = Math.min(fromY, toY) - Math.max(70, dist * 0.2);

      const flight: Flight = {
        id: `f-${card.instanceId}-${Date.now()}`,
        card,
        slotIndex,
        cardW,
        cardH,
        fromX,
        fromY,
        midX,
        toX,
        toY,
        arcY,
        toScale,
      };
      inFlightIdsRef.current.add(card.instanceId);
      setFlights((prev) => [...prev, flight]);
    },
    [onDraw, slots.length],
  );

  const completeFlight = useCallback(
    (flight: Flight) => {
      onDraw(flight.card);
      setFlashIndex(flight.slotIndex);
      window.setTimeout(() => {
        setFlashIndex((cur) => (cur === flight.slotIndex ? null : cur));
      }, 600);
      flightElRefs.current.delete(flight.id);
      inFlightIdsRef.current.delete(flight.card.instanceId);
      setFlights((prev) => prev.filter((f) => f.id !== flight.id));
    },
    [onDraw],
  );

  // Hit-test the topmost card under a point (so a pinch grabs exactly one).
  const findCardAt = useCallback((x: number, y: number): SessionDeckCard | null => {
    let best: SessionDeckCard | null = null;
    let bestZ = -Infinity;
    for (const card of railRef.current) {
      const el = cardRefs.current.get(card.instanceId);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        const z = Number.parseInt(getComputedStyle(el).zIndex, 10);
        const zVal = Number.isFinite(z) ? z : 0;
        if (zVal >= bestZ) {
          bestZ = zVal;
          best = card;
        }
      }
    }
    return best;
  }, []);

  // Golden particle trail: a fixed, full-viewport canvas that high-frequency
  // emits shrinking, glowing gold sparks at each in-flight card's live center.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    type P = { x: number; y: number; vx: number; vy: number; size: number; life: number; max: number };
    const particles: P[] = [];
    let raf = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const spawn = (cx: number, cy: number) => {
      const ang = Math.random() * Math.PI * 2;
      const sp = Math.random() * 1.8 + 0.3;
      const max = Math.random() * 28 + 26;
      particles.push({
        x: cx + (Math.random() - 0.5) * 12,
        y: cy + (Math.random() - 0.5) * 12,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 0.4,
        size: Math.random() * 4 + 2.5,
        life: max,
        max,
      });
    };

    const loop = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      flightElRefs.current.forEach((el) => {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        for (let i = 0; i < 4; i++) spawn(cx, cy);
      });

      ctx.globalCompositeOperation = "lighter";
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.03;
        p.vx *= 0.98;
        p.life -= 1;
        p.size *= 0.95;
        if (p.life <= 0 || p.size < 0.4) {
          particles.splice(i, 1);
          continue;
        }
        const a = Math.max(0, p.life / p.max);
        const radius = p.size * 2.6;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
        g.addColorStop(0, `rgba(255,231,160,${a})`);
        g.addColorStop(0.4, `rgba(240,168,58,${a * 0.6})`);
        g.addColorStop(1, "rgba(201,130,31,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  // Hand loop: (1) open-hand horizontal move → browse the rail; (2) pinch over a
  // card → choose it (one pinch = one card, with a cooldown). No long press, no
  // drag-up: this matches the design's "swipe then tap to choose".
  useEffect(() => {
    let raf = 0;
    let pinchPrev = false;
    let cooldown = 0;
    let lastSwipeX: number | null = null;

    const loop = () => {
      const p = pointerRef.current;
      const now = performance.now();

      if (!lockedRef.current && p.handActive) {
        if (!p.down) {
          // Browse: translate the rail by the hand's horizontal motion.
          if (lastSwipeX !== null) {
            const dx = p.x - lastSwipeX;
            if (Math.abs(dx) > 0.5) {
              const next = Math.max(minPoolX(), Math.min(0, poolX.get() + dx));
              poolX.set(next);
            }
          }
          lastSwipeX = p.x;
          pinchPrev = false;
        } else {
          // Choose: fire once on the pinch's rising edge over a card.
          if (!pinchPrev && now > cooldown) {
            const card = findCardAt(p.x, p.y);
            if (card) {
              launch(card);
              cooldown = now + 450;
            }
          }
          pinchPrev = true;
          lastSwipeX = null;
        }
      } else {
        lastSwipeX = null;
        pinchPrev = false;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [pointerRef, launch, poolX, minPoolX, findCardAt]);

  const poolConfig =
    spreadId === "either"
      ? { bottom: "10%", cardWidth: 84, gap: 10 }
      : { bottom: "16.2%", cardWidth: 86, gap: 10 };

  return (
    <motion.div
      className="sm-layer sm-draw"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Slot frames are always mounted (even when empty) so the flight can
          measure its target and the gold border can breathe / flash. The
          committed card back appears the instant its flight lands. */}
      {slots.map((slot, index) => {
        const committed = index < drawnCards.length;
        const arming = flights.some((f) => f.slotIndex === index);
        const flash = flashIndex === index;
        return (
          <div
            key={index}
            ref={(el) => {
              if (el) slotRefs.current.set(index, el);
              else slotRefs.current.delete(index);
            }}
            className={cn("sm-slot-frame", arming && "is-arming", flash && "is-flash")}
            style={{
              position: "absolute",
              left: `${slot.left}%`,
              top: `${slot.top}%`,
              width: `${spreadLayout.cardWidth}%`,
              aspectRatio: "1086 / 1448",
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
              zIndex: 6,
            }}
          >
            {committed && (
              <motion.img
                src={BACK_SRC}
                alt="已抽取的牌背面"
                draggable={false}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
                initial={{ opacity: 0, scale: 1.08 }}
                animate={{ opacity: 1, scale: [1.05, 0.99, 1] }}
                transition={{ duration: 0.45, ease: "easeOut" }}
              />
            )}
          </div>
        );
      })}

      {/* Bottom carousel — sits over the design's painted card strip. Mouse drag
          (framer) and hand swipe both move it; tap / pinch a card to choose. */}
      {!locked && (
        <div
          className="sm-pool-wrap"
          ref={poolWrapRef}
          style={{ position: "absolute", left: "5%", right: "5%", bottom: poolConfig.bottom }}
          aria-label={`${SPREADS[spreadId].title} 牌堆`}
        >
          <motion.div
            className="sm-pool"
            ref={poolRef}
            style={{
              x: poolX,
              ["--sm-pool-card-width" as string]: `${poolConfig.cardWidth}px`,
              ["--sm-pool-gap" as string]: `${poolConfig.gap}px`,
            }}
            drag="x"
            dragConstraints={poolWrapRef}
            dragElastic={0.06}
            dragMomentum
            onDragStart={() => {
              draggingRef.current = true;
            }}
            onDragEnd={() => {
              // Let a tap that immediately follows a drag be ignored.
              window.setTimeout(() => {
                draggingRef.current = false;
              }, 80);
            }}
          >
            {railDeck.map((card) => (
              <motion.div
                key={card.instanceId}
                ref={(el) => {
                  if (el) cardRefs.current.set(card.instanceId, el);
                  else cardRefs.current.delete(card.instanceId);
                }}
                className="sm-pool-card"
                data-gesture-ignore
                whileHover={{ y: -10, scale: 1.06 }}
                whileTap={{ scale: 1.12 }}
                onTap={() => {
                  if (draggingRef.current) return; // was a swipe, not a tap
                  launch(card);
                }}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: inFlightIdsRef.current.has(card.instanceId) ? 0 : 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.6 }}
              >
                <img src={BACK_SRC} alt="" draggable={false} />
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}

      {/* Fixed, full-viewport flight layer: golden particle canvas + the cards
          arcing from the pool into their slots. */}
      <div
        className="sm-flight-layer"
        style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 60 }}
        aria-hidden="true"
      >
        <canvas ref={canvasRef} className="sm-flight-canvas" />
        {flights.map((f) => (
          <motion.img
            key={f.id}
            ref={(el) => {
              if (el) flightElRefs.current.set(f.id, el);
              else flightElRefs.current.delete(f.id);
            }}
            src={BACK_SRC}
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: f.cardW,
              height: f.cardH,
              objectFit: "contain",
              willChange: "transform",
              filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.45))",
            }}
            initial={{ x: f.fromX, y: f.fromY, rotate: 0, scale: 1 }}
            animate={{
              x: [f.fromX, f.midX, f.toX],
              y: [f.fromY, f.arcY, f.toY],
              rotate: [0, 5, 8],
              scale: [1, 1.05, f.toScale],
            }}
            transition={{ duration: FLIGHT_MS / 1000, ease: [0.16, 1, 0.3, 1], times: [0, 0.5, 1] }}
            onAnimationComplete={() => completeFlight(f)}
          />
        ))}
      </div>

    </motion.div>
  );
}

/* ------------------------------------------------ REVERSAL (swipe to flip) */

function ReversalStage({
  drawnCards,
  onRevealed,
}: {
  drawnCards: DrawnCard[];
  onRevealed: () => void;
}) {
  const { pointerRef } = useGesture();
  const [flipped, setFlipped] = useState(false);
  const flippedRef = useRef(false);

  const FLIP_STAGGER_MS = 420;
  const FLIP_DURATION_MS = 1450;

  const trigger = useCallback(() => {
    if (flippedRef.current) return;
    flippedRef.current = true;
    setFlipped(true);
    const totalMs = FLIP_DURATION_MS + Math.max(0, drawnCards.length - 1) * FLIP_STAGGER_MS;
    window.setTimeout(onRevealed, totalMs + 280);
  }, [drawnCards.length, onRevealed]);

  // Swipe-right detection (hand): track left→right horizontal travel.
  useEffect(() => {
    let raf = 0;
    const buf: Array<{ x: number; t: number }> = [];
    const loop = () => {
      const p = pointerRef.current;
      const now = performance.now();
      if (p.handActive) {
        buf.push({ x: p.x, t: now });
        while (buf.length && now - buf[0].t > 500) buf.shift();
        if (buf.length > 3 && !flippedRef.current) {
          const dx = buf[buf.length - 1].x - buf[0].x;
          if (dx > window.innerWidth * 0.22) trigger();
        }
      } else {
        buf.length = 0;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [pointerRef, trigger]);

  return (
    <motion.div
      className="sm-layer sm-reversal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="sm-flip-scene">
        <div className="sm-flip-row">
          {drawnCards.map((card, index) => (
            <div key={card.position} className="sm-flip-item-scene">
              <motion.div
                className="sm-flip-item"
                animate={{ rotateY: flipped ? 180 : 0 }}
                transition={{
                  duration: FLIP_DURATION_MS / 1000,
                  delay: (index * FLIP_STAGGER_MS) / 1000,
                  ease: [0.22, 0.61, 0.36, 1],
                }}
              >
                <div className="sm-flip-inner">
                  <div className="sm-flip-face sm-flip-front">
                    <img src={BACK_SRC} alt="" draggable={false} />
                  </div>
                  <div className="sm-flip-face sm-flip-back">
                    <img
                      src={getCardFrontPath(card.number)}
                      alt={`${card.name}${card.state}`}
                      className={cn(card.state === "逆位" && "is-reversed")}
                      draggable={false}
                    />
                  </div>
                </div>
              </motion.div>
            </div>
          ))}
        </div>
      </div>

      {!flipped && (
        <button type="button" className="sm-swipe-hit" onClick={trigger} data-gesture aria-label="向右滑动揭晓">
          <motion.span
            className="sm-reveal-hint"
            animate={{ opacity: [0.5, 1, 0.5], x: [0, 14, 0] }}
            transition={{ duration: 1.8, repeat: Number.POSITIVE_INFINITY }}
          >
            向右滑动揭晓 →
          </motion.span>
        </button>
      )}
    </motion.div>
  );
}

/* --------------------------------------------------------- END (reading) */

function Typewriter({
  text,
  speed = 26,
  startDelay = 0,
}: {
  text: string;
  speed?: number;
  startDelay?: number;
}) {
  const [shown, setShown] = useState("");

  useEffect(() => {
    setShown("");
    if (!text) return;
    let i = 0;
    let interval = 0;
    const start = window.setTimeout(() => {
      interval = window.setInterval(() => {
        i += 1;
        setShown(text.slice(0, i));
        if (i >= text.length) window.clearInterval(interval);
      }, speed);
    }, startDelay);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(interval);
    };
  }, [text, speed, startDelay]);

  return <>{shown}</>;
}

function EndStage({
  spread,
  drawnCards,
  reading,
  isLoading,
  error,
  onReset,
}: {
  spread: (typeof SPREADS)[SpreadId];
  drawnCards: DrawnCard[];
  reading:
    | { summary: string; perCard: Array<{ position: string; title: string; text: string }> }
    | null;
  isLoading: boolean;
  error: string | null;
  onReset: () => void;
}) {
  const { pointerRef } = useGesture();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Hand vertical pan → smooth scroll the reading panel (no click-to-page).
  useEffect(() => {
    let raf = 0;
    let lastY: number | null = null;
    const loop = () => {
      const p = pointerRef.current;
      const el = scrollRef.current;
      if (el && p.handActive && !p.down) {
        if (lastY !== null) {
          const dy = p.y - lastY;
          if (Math.abs(dy) > 1) el.scrollBy({ top: dy * 2.4 });
        }
        lastY = p.y;
      } else {
        lastY = null;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [pointerRef]);

  return (
    <motion.div
      className="sm-layer sm-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="sm-end-panel" ref={scrollRef}>
        <header className="sm-result-head">
          <p className="sm-kicker">{spread.title}</p>
          <h1>{spread.interpretationTitle}</h1>
          <p className="sm-sub">{spread.subtitle}</p>
          <button type="button" className="sm-pill" onClick={onReset} data-gesture>
            <RotateCcw className="size-4" /> 重新占卜
          </button>
        </header>

        <div className="sm-card-row">
          {drawnCards.map((card, index) => (
            <motion.figure
              key={card.position}
              className="sm-result-card"
              initial={{ rotateY: 90, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              transition={{ ...spring, delay: index * 0.14 }}
            >
              <img
                src={getCardFrontPath(card.number)}
                alt={`${card.name}${card.state}`}
                className={cn(card.state === "逆位" && "is-reversed")}
                draggable={false}
              />
              <figcaption>
                <span className="sm-pos">{card.position}</span>
                <strong>
                  {card.name} · {card.state}
                </strong>
              </figcaption>
            </motion.figure>
          ))}
        </div>

        <div className="sm-reading">
          <p className="sm-reading-kicker">本次牌讯</p>
          <p className="sm-reading-summary">
            {isLoading ? (
              "正在召唤解读……"
            ) : error ? (
              error
            ) : (
              <Typewriter text={reading?.summary ?? ""} speed={24} />
            )}
          </p>
          <div className="sm-reading-grid">
            {drawnCards.map((card, index) => {
              const item = reading?.perCard.find((entry) => entry.position === card.position);
              return (
                <article key={card.position} className="sm-reading-item">
                  <h3>{item?.title ?? `${card.position}｜${card.name} · ${card.state}`}</h3>
                  <p>
                    {item?.text ? (
                      <Typewriter text={item.text} speed={30} startDelay={400 + index * 220} />
                    ) : isLoading ? (
                      ""
                    ) : (
                      "—"
                    )}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ----------------------------------------------------------- SHARED BITS */

function Hotspot({
  label,
  left,
  top,
  width,
  height,
  onClick,
  round,
  muted,
  className,
  rotate,
}: {
  label: string;
  left: string;
  top: string;
  width: string;
  height: string;
  onClick: () => void;
  round?: boolean;
  muted?: boolean;
  className?: string;
  rotate?: string;
}) {
  const style = {
    left,
    top,
    width,
    height,
    "--sm-rotate": rotate ?? "0deg",
  } as CSSProperties;

  return (
    <button
      type="button"
      className={cn("sm-hotspot", round && "is-round", muted && "is-muted", className)}
      style={style}
      onClick={onClick}
      aria-label={label}
    />
  );
}
