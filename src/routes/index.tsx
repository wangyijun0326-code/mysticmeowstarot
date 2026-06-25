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
  // Synchronous mirror of selectedIds. State updaters can run twice under React
  // StrictMode; the previous code called setDrawnCards INSIDE the setSelectedIds
  // updater, so one pick added two cards (the "选了一张却变两张 / 6/5" bug).
  // A ref lets drawCard guard and commit exactly once per gesture.
  const selectedRef = useRef<string[]>([]);
  const [reading, setReading] = useState<
    { summary: string; perCard: Array<{ position: string; title: string; text: string }> } | null
  >(null);
  const [isLoadingReading, setIsLoadingReading] = useState(false);
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
    if (gameState === "SUCCESS") return assetUrl(a.success);
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
        case "SUCCESS":
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
        const engaged =
          !doneRef.current &&
          (p.handActive || p.down) &&
          distToCenter < unit * 3.2 &&
          speed > 0.6;

        if (engaged) {
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

        if (totalAngle > Math.PI * 6) finish();
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

      {/* Transparent trigger sitting on the design's own painted 完成洗牌 button —
          no duplicate pill, no overlapping hint text. Fine-tune left/top/width/
          height in preview so it lands exactly on the painted button. */}
      <Hotspot label="完成洗牌" left="50%" top="92%" width="14%" height="7%" onClick={finish} />
    </motion.div>
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

  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const poolWrapRef = useRef<HTMLDivElement | null>(null);
  const poolRef = useRef<HTMLDivElement | null>(null);
  // Single controlled offset for the carousel — driven by BOTH mouse drag
  // (framer) and hand swipe, so the rail moves either way.
  const poolX = useMotionValue(0);

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
              onDraw(card);
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
  }, [pointerRef, onDraw, poolX, minPoolX, findCardAt]);

  return (
    <motion.div
      className="sm-layer sm-draw"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Chosen cards animate into the design's own painted slots. Positions
          come from SLOT_LAYOUTS (already tuned to the screenshots). Tune the
          width / coordinates in preview if a card sits slightly off a slot. */}
      {slots.map((slot, index) => {
        const card = drawnCards[index];
        if (!card) return null;
        return (
          <div
            key={index}
            style={{
              position: "absolute",
              left: slot.left,
              top: slot.top,
              width: "9%",
              aspectRatio: "1086 / 1448",
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
              zIndex: 6,
            }}
          >
            <motion.img
              src={BACK_SRC}
              alt="已抽取的牌背面"
              draggable={false}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
              initial={{ opacity: 0, y: 70, scale: 0.6 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={spring}
            />
          </div>
        );
      })}

      {/* Bottom carousel — sits over the design's painted card strip. Mouse drag
          (framer) and hand swipe both move it; tap / pinch a card to choose. */}
      {!locked && (
        <div
          className="sm-pool-wrap"
          ref={poolWrapRef}
          style={{ position: "absolute", left: 0, right: 0, bottom: "3%" }}
          aria-label={`${SPREADS[spreadId].title} 牌堆`}
        >
          <motion.div
            className="sm-pool"
            ref={poolRef}
            style={{ x: poolX }}
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
                  onDraw(card);
                }}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.6 }}
              >
                <img src={BACK_SRC} alt="" draggable={false} />
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}
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
