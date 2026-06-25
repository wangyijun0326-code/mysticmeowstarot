import { createFileRoute } from "@tanstack/react-router";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, RotateCcw } from "lucide-react";
import {
  SPREADS,
  SPREAD_ASSETS,
  SLOT_LAYOUTS,
  createSessionDeck,
  getCardFrontPath,
  type DrawnCard,
  type SpreadId,
} from "@/lib/tarot";
import { generateTarotReading } from "@/lib/tarot-reading.functions";
import { useGesture } from "@/components/gesture/gesture-provider";
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
 *   MENU → SPREAD_SELECTION → SHUFFLE → DRAWING → SUCCESS → REVERSAL → END
 */
type GameState =
  | "MENU"
  | "SPREAD_SELECTION"
  | "SHUFFLE"
  | "DRAWING"
  | "SUCCESS"
  | "REVERSAL"
  | "END";

type SessionDeckCard = ReturnType<typeof createSessionDeck>[number];

const BACK_SRC = "/assets/back.png";
const assetUrl = (file: string) => `/assets/${file}`;
const spring = { type: "spring", stiffness: 200, damping: 24, mass: 0.8 } as const;

function Index() {
  const [gameState, setGameState] = useState<GameState>("MENU");
  const [spreadId, setSpreadId] = useState<SpreadId | null>(null);
  const [deck, setDeck] = useState<SessionDeckCard[]>(() => createSessionDeck());
  const [drawnCards, setDrawnCards] = useState<DrawnCard[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reading, setReading] = useState<
    { summary: string; perCard: Array<{ position: string; title: string; text: string }> } | null
  >(null);
  const [isLoadingReading, setIsLoadingReading] = useState(false);
  const [readingError, setReadingError] = useState<string | null>(null);
  const readingRequested = useRef(false);

  const spread = spreadId ? SPREADS[spreadId] : null;
  const requiredCount = spread?.positions.length ?? 0;
  const isDrawComplete = requiredCount > 0 && drawnCards.length === requiredCount;

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
    if (gameState === "SUCCESS") return assetUrl(a.success);
    if (gameState === "REVERSAL") return assetUrl(a.reversal);
    if (gameState === "END") return assetUrl(a.end);
    return null; // DRAWING renders a live DOM layout, not a screenshot.
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

  // Phase 3 trigger: once every required slot is filled → SUCCESS.
  useEffect(() => {
    if (gameState === "DRAWING" && isDrawComplete) setGameState("SUCCESS");
  }, [gameState, isDrawComplete]);

  // SUCCESS → REVERSAL automatically after the confirmation art lingers 1.5s.
  useEffect(() => {
    if (gameState !== "SUCCESS") return;
    const id = window.setTimeout(() => setGameState("REVERSAL"), 1500);
    return () => window.clearTimeout(id);
  }, [gameState]);

  // REVERSAL → END (kick off the reading on entry).
  const goToEnd = useCallback(() => {
    setGameState("END");
    void runReading();
  }, [runReading]);

  const chooseSpread = (next: SpreadId) => {
    setSpreadId(next);
    setDeck(createSessionDeck());
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
      setSelectedIds((prevSel) => {
        if (prevSel.includes(card.instanceId)) return prevSel;
        if (prevSel.length >= spread.positions.length) return prevSel;
        const nextIndex = prevSel.length;
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
        return [...prevSel, card.instanceId];
      });
    },
    [spread],
  );

  const resetAll = useCallback(() => {
    setSpreadId(null);
    setDeck(createSessionDeck());
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
        case "SUCCESS":
        case "REVERSAL":
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

  const showResult = gameState === "END";

  return (
    <div className="sm-root">
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

/* ------------------------------------------------------------------ MENU */

function MenuOverlay({ onStart }: { onStart: () => void }) {
  return (
    <motion.div
      className="sm-layer"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <Hotspot label="开始占卜" left="75.3%" top="66.5%" width="9.5%" height="22%" onClick={onStart} />
      <Hotspot
        label="使用指南"
        left="89.6%"
        top="66.5%"
        width="9.5%"
        height="22%"
        onClick={() => undefined}
        muted
      />
    </motion.div>
  );
}

/* -------------------------------------------------------- SPREAD SELECTION */

function SpreadOverlay({ onChoose }: { onChoose: (id: SpreadId) => void }) {
  const panels: Array<{ id: SpreadId; left: string }> = [
    { id: "daily", left: "24.5%" },
    { id: "three", left: "50%" },
    { id: "either", left: "75.3%" },
  ];
  return (
    <motion.div
      className="sm-layer"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {panels.map((panel) => (
        <Hotspot
          key={panel.id}
          label={SPREADS[panel.id].subtitle}
          left={panel.left}
          top="56%"
          width="20.5%"
          height="48%"
          onClick={() => onChoose(panel.id)}
        />
      ))}
    </motion.div>
  );
}

/* -------------------------------------------------- SHUFFLE (physics pile) */

const PILE_SIZE = 78;

type ScatterSpec = {
  dx: number; // % of stage width
  dy: number; // % of stage height
  baseRot: number;
  spin: number;
};

function buildPile(): ScatterSpec[] {
  return Array.from({ length: PILE_SIZE }, (_, i) => {
    // Random direction + random centrifugal distance so each card flies out on
    // its own vector (viewport-relative units = visible, real scatter).
    const angle = (i / PILE_SIZE) * Math.PI * 2 + (Math.random() - 0.5) * 1.4;
    const radius = 8 + Math.random() * 26; // in vmin → faster gesture = wider
    return {
      dx: Math.cos(angle) * radius,
      dy: Math.sin(angle) * radius * 0.78,
      baseRot: (Math.random() - 0.5) * 16,
      spin: (Math.random() - 0.5) * 320,
    };
  });
}

function ShuffleStage({ onDone }: { onDone: () => void }) {
  const { pointerRef, status, enabled } = useGesture();
  const [shuffling, setShuffling] = useState(false);
  const doneRef = useRef(false);
  const pileRef = useRef<HTMLDivElement | null>(null);
  const pile = useMemo(buildPile, []);

  // One shared energy value drives every card's centrifugal scatter spring.
  const energy = useSpring(0, { stiffness: 90, damping: 15, mass: 0.7 });

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setShuffling(true);
    energy.set(1);
    window.setTimeout(onDone, 1400);
  }, [energy, onDone]);

  // Circular "wash" detection from the unified pointer (hand pinch-free OR mouse drag).
  useEffect(() => {
    let raf = 0;
    let energyVal = 0;
    let totalAngle = 0;
    let prevAngle: number | null = null;
    let lastX = 0;
    let lastY = 0;

    const loop = () => {
      const p = pointerRef.current;
      const rect = pileRef.current?.getBoundingClientRect();
      if (rect && !doneRef.current) {
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = p.x - cx;
        const dy = p.y - cy;
        const dist = Math.hypot(dx, dy);
        const moved = Math.hypot(p.x - lastX, p.y - lastY) > 1.5;
        lastX = p.x;
        lastY = p.y;
        // Hand: active hand over the pile. Mouse: button held over the pile.
        const engaged =
          dist < rect.width * 1.1 && moved && (p.handActive || p.down);

        if (engaged) {
          const ang = Math.atan2(dy, dx);
          if (prevAngle !== null) {
            let d = ang - prevAngle;
            if (d > Math.PI) d -= 2 * Math.PI;
            if (d < -Math.PI) d += 2 * Math.PI;
            totalAngle += Math.abs(d);
            energyVal = Math.min(1, energyVal + Math.abs(d) * 0.55);
          }
          prevAngle = ang;
        } else {
          prevAngle = null;
        }
        energyVal *= 0.94;
        energy.set(energyVal);

        if (totalAngle > Math.PI * 4) finish();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [pointerRef, energy, finish]);

  return (
    <motion.div
      className="sm-layer sm-shuffle"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="sm-pile" ref={pileRef}>
        {pile.map((spec, i) => (
          <ShuffleCard key={i} energy={energy} spec={spec} index={i} />
        ))}
        <AnimatePresence>
          {shuffling && (
            <motion.div
              className="sm-pile-glow"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: [0, 0.9, 0], scale: [0.6, 1.3, 1.6] }}
              transition={{ duration: 1.3 }}
            />
          )}
        </AnimatePresence>
      </div>

      <div className="sm-shuffle-controls">
        <p className="sm-status">{shuffleHint(enabled, status, shuffling)}</p>
        <button type="button" className="sm-pill" onClick={finish} data-gesture>
          完成洗牌
        </button>
      </div>
    </motion.div>
  );
}

function ShuffleCard({
  energy,
  spec,
  index,
}: {
  energy: MotionValue<number>;
  spec: ScatterSpec;
  index: number;
}) {
  // Per-card spring physics layered on the shared energy value: when the
  // gesture stops, each card eases back / settles with its own damping, giving
  // an organic "real shuffle" feel instead of a rigid block.
  const cfg = useMemo(
    () => ({
      stiffness: 70 + Math.random() * 90,
      damping: 11 + Math.random() * 9,
      mass: 0.5 + Math.random() * 0.5,
    }),
    [],
  );
  const tx = useTransform(energy, (e) => spec.dx * e);
  const ty = useTransform(energy, (e) => spec.dy * e);
  const trot = useTransform(energy, (e) => spec.baseRot + spec.spin * e);
  const sx = useSpring(tx, cfg);
  const sy = useSpring(ty, cfg);
  const srot = useSpring(trot, cfg);
  const x = useTransform(sx, (v) => `${v}vmin`);
  const y = useTransform(sy, (v) => `${v}vmin`);
  return (
    <motion.img
      src={BACK_SRC}
      alt=""
      draggable={false}
      className="sm-pile-card"
      style={{ x, y, rotate: srot, zIndex: index }}
    />
  );
}

function shuffleHint(
  enabled: boolean,
  status: ReturnType<typeof useGesture>["status"],
  shuffling: boolean,
) {
  if (shuffling) return "✦ 牌灵流动中……";
  if (!enabled) return "在牌堆上方按住鼠标画圈搓牌，或点击「完成洗牌」";
  switch (status) {
    case "tracking":
      return "把手放在牌堆上方画圈，离心力会让牌散开洗匀";
    case "denied":
    case "error":
      return "摄像头不可用，可按住鼠标在牌堆上画圈搓牌";
    default:
      return "手势准备中，可先用鼠标在牌堆上画圈搓牌";
  }
}

/* ----------------------------------- DRAWING (pinch · drag · release) */

type DragPhase = "idle" | "pressing" | "dragging";

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
  const slots = SLOT_LAYOUTS[spreadId];

  const stageRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const floatRef = useRef<HTMLDivElement | null>(null);
  // Wrapper that clips the carousel; the inner track drags horizontally within it.
  const poolWrapRef = useRef<HTMLDivElement | null>(null);

  const [pressId, setPressId] = useState<string | null>(null);
  const [grabbed, setGrabbed] = useState<SessionDeckCard | null>(null);
  // Singleton lock: id of the card currently dragged via mouse/touch (framer).
  const [mouseDragId, setMouseDragId] = useState<string | null>(null);

  const railRef = useRef(railDeck);
  railRef.current = railDeck;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  const grabbedRef = useRef<SessionDeckCard | null>(null);
  grabbedRef.current = grabbed;
  // True whenever ANY single card is being held (hand pinch OR mouse drag).
  const mouseDragRef = useRef<string | null>(null);
  mouseDragRef.current = mouseDragId;
  const isHoldingCard = !!grabbed || !!mouseDragId;

  const PRESS_MS = 500;
  const DEBOUNCE_MS = 300;

  useEffect(() => {
    let raf = 0;
    let phase: DragPhase = "idle";
    let pressCardId: string | null = null;
    let pressStart = 0;
    let cooldownUntil = 0;

    // Hit-test under the cursor and return ONLY the single topmost card
    // (highest z-index), so a pinch over overlapping cards grabs exactly one.
    const findCardAt = (x: number, y: number): SessionDeckCard | null => {
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
    };

    const inSlotZone = (y: number): boolean => {
      const r = stageRef.current?.getBoundingClientRect();
      if (!r) return false;
      return y < r.top + r.height * 0.62; // upper area = slot drop target
    };

    const loop = () => {
      const p = pointerRef.current;
      const now = performance.now();

      if (lockedRef.current) {
        phase = "idle";
        pressCardId = null;
        raf = requestAnimationFrame(loop);
        return;
      }

      if (phase === "idle") {
        // Mouse drag is handled by Framer Motion drag below; the pointer loop
        // only drives the hand-gesture (pinch) flow.
        if (p.source === "hand" && p.down && now > cooldownUntil && !mouseDragRef.current) {
          const card = findCardAt(p.x, p.y);
          if (card) {
            phase = "pressing";
            pressCardId = card.instanceId;
            pressStart = now;
            setPressId(card.instanceId);
          }
        }
      } else if (phase === "pressing") {
        if (!p.down) {
          phase = "idle";
          pressCardId = null;
          setPressId(null);
          cooldownUntil = now + DEBOUNCE_MS;
        } else if (now - pressStart > PRESS_MS) {
          const card = railRef.current.find((c) => c.instanceId === pressCardId) ?? null;
          if (card) {
            phase = "dragging";
            grabbedRef.current = card;
            setGrabbed(card);
            setPressId(null);
          } else {
            phase = "idle";
            pressCardId = null;
            setPressId(null);
          }
        }
      } else if (phase === "dragging") {
        const fl = floatRef.current;
        if (fl) fl.style.transform = `translate(${p.x}px, ${p.y}px)`;
        if (!p.down) {
          const card = grabbedRef.current;
          const commit = inSlotZone(p.y);
          phase = "idle";
          pressCardId = null;
          grabbedRef.current = null;
          setGrabbed(null);
          cooldownUntil = now + DEBOUNCE_MS;
          if (card && commit) onDraw(card);
        }
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [pointerRef, onDraw]);

  const spread = SPREADS[spreadId];

  return (
    <motion.div
      className="sm-layer sm-draw"
      ref={stageRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* ---------- Top zone: spread slots (dashed empty placeholders) ---------- */}
      <div className="sm-draw-top">
        <div className="sm-slots">
          {slots.map((_, index) => {
            const card = drawnCards[index];
            const isNext = index === drawnCards.length;
            return (
              <div key={index} className={cn("sm-slot2", isNext && !locked && "is-target")}>
                {card ? (
                  <motion.img
                    src={BACK_SRC}
                    alt="已抽取的牌背面"
                    draggable={false}
                    initial={{ opacity: 0, y: 80, scale: 0.6 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={spring}
                  />
                ) : (
                  <span className="sm-slot2-label">{index + 1}</span>
                )}
              </div>
            );
          })}
        </div>
        <p className="sm-status">
          {locked
            ? "牌阵已成，正在召唤……"
            : `向上拖动卡牌放入空槽（捏合并上移亦可） · ${drawnCards.length}/${slots.length}`}
        </p>
      </div>

      {/* ---------- Bottom zone: drag-x carousel of the 78-card deck ---------- */}
      {!locked && (
        <div className="sm-pool-wrap" ref={poolWrapRef} aria-label={`${spread.title} 牌堆`}>
          <motion.div
            className="sm-pool"
            drag="x"
            dragConstraints={poolWrapRef}
            dragElastic={0.06}
            dragMomentum
          >
            {railDeck.map((card) => {
              const isPressing = pressId === card.instanceId;
              const isGrabbed = grabbed?.instanceId === card.instanceId;
              // Singleton lock: while another card is held, this one cannot be
              // grabbed and is visually muted.
              const lockedOut = isHoldingCard && mouseDragId !== card.instanceId && !isGrabbed;
              return (
                <motion.div
                  key={card.instanceId}
                  ref={(el) => {
                    if (el) cardRefs.current.set(card.instanceId, el);
                    else cardRefs.current.delete(card.instanceId);
                  }}
                  className={cn(
                    "sm-pool-card",
                    isPressing && "is-selected",
                    isGrabbed && "is-grabbed",
                    lockedOut && "is-locked-out",
                  )}
                  data-gesture-ignore
                  drag={lockedOut ? false : "y"}
                  dragSnapToOrigin
                  dragConstraints={{ top: -600, bottom: 0 }}
                  dragElastic={0.25}
                  whileDrag={{ scale: 1.14, zIndex: 60 }}
                  onDragStart={() => setMouseDragId(card.instanceId)}
                  onDragEnd={(_, info) => {
                    setMouseDragId(null);
                    // Drag-up past 50px → fly the card into the next empty slot.
                    if (info.offset.y < -50) onDraw(card);
                  }}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                >
                  <img src={BACK_SRC} alt="" draggable={false} />
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      )}

      {/* Floating card that follows the hand while pinch-dragging */}
      <div ref={floatRef} className={cn("sm-drag-card", grabbed && "is-active")}>
        {grabbed && <img src={BACK_SRC} alt="" draggable={false} />}
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

  const trigger = useCallback(() => {
    if (flippedRef.current) return;
    flippedRef.current = true;
    setFlipped(true);
    window.setTimeout(onRevealed, 1100);
  }, [onRevealed]);

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
      {/* Full-stage 3D flip surface */}
      <div className="sm-flip-scene">
        <motion.div
          className="sm-flip-card"
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 1, ease: [0.4, 0, 0.2, 1] }}
        >
          <div className="sm-flip-face sm-flip-front">
            <div className="sm-flip-row">
              {drawnCards.map((card) => (
                <img key={card.position} src={BACK_SRC} alt="" draggable={false} />
              ))}
            </div>
          </div>
          <div className="sm-flip-face sm-flip-back">
            <div className="sm-flip-row">
              {drawnCards.map((card) => (
                <img
                  key={card.position}
                  src={getCardFrontPath(card.number)}
                  alt={`${card.name}${card.state}`}
                  className={cn(card.state === "逆位" && "is-reversed")}
                  draggable={false}
                />
              ))}
            </div>
          </div>
        </motion.div>
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
          <p className="sm-reading-kicker">AI 中性深度解读</p>
          <p className="sm-reading-summary">
            {isLoading ? "正在召唤解读……" : error ? error : reading?.summary}
          </p>
          <div className="sm-reading-grid">
            {drawnCards.map((card) => {
              const item = reading?.perCard.find((entry) => entry.position === card.position);
              return (
                <article key={card.position} className="sm-reading-item">
                  <h3>{item?.title ?? `${card.position}｜${card.name} · ${card.state}`}</h3>
                  <p>{item?.text ?? (isLoading ? "" : "—")}</p>
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
}: {
  label: string;
  left: string;
  top: string;
  width: string;
  height: string;
  onClick: () => void;
  round?: boolean;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn("sm-hotspot", round && "is-round", muted && "is-muted")}
      style={{ left, top, width, height }}
      onClick={onClick}
      aria-label={label}
    />
  );
}
