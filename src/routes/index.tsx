import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion, useMotionValue } from "framer-motion";
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
      { title: "Mystic Meows Tarot" },
      {
        name: "description",
        content: "沉浸式猫咪塔罗抽牌体验，含手势交互、动态牌阵与 AI 中性解读。",
      },
      { property: "og:title", content: "Mystic Meows Tarot" },
      {
        property: "og:description",
        content: "沉浸式猫咪塔罗抽牌体验，含手势交互、动态牌阵与 AI 中性解读。",
      },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Index,
});

type GameState =
  | "MENU"
  | "SPREAD_SELECTION"
  | "SHUFFLE"
  | "DRAWING"
  | "SUCCESS"
  | "REVERSAL"
  | "END";

type SessionDeckCard = ReturnType<typeof createSessionDeck>[number];

type ReadingResult = {
  summary: string;
  perCard: Array<{ position: string; title: string; text: string }>;
};

const BACK_SRC = "/assets/back.png";
const assetUrl = (file: string) => `/assets/${encodeURIComponent(file)}`;
const slotAspect = "1086 / 1448";
const spring = { type: "spring", stiffness: 210, damping: 24, mass: 0.82 } as const;

function Index() {
  const [gameState, setGameState] = useState<GameState>("MENU");
  const [spreadId, setSpreadId] = useState<SpreadId | null>(null);
  const [deck, setDeck] = useState<SessionDeckCard[]>(() => createSessionDeck());
  const [drawnCards, setDrawnCards] = useState<DrawnCard[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedRef = useRef<string[]>([]);
  const [reading, setReading] = useState<ReadingResult | null>(null);
  const [isLoadingReading, setIsLoadingReading] = useState(false);
  const [readingError, setReadingError] = useState<string | null>(null);
  const readingRequested = useRef(false);

  const spread = spreadId ? SPREADS[spreadId] : null;
  const requiredCount = spread?.positions.length ?? 0;
  const isDrawComplete = requiredCount > 0 && drawnCards.length >= requiredCount;

  const railDeck = useMemo(
    () => deck.filter((card) => !selectedIds.includes(card.instanceId)),
    [deck, selectedIds],
  );

  const baseImage = useMemo(() => {
    if (gameState === "MENU") return assetUrl("menu.png");
    if (gameState === "SPREAD_SELECTION") return assetUrl("spreads.png");
    if (gameState === "SHUFFLE") return assetUrl("wash.png");
    if (!spreadId) return null;
    const assets = SPREAD_ASSETS[spreadId];
    if (gameState === "DRAWING" || gameState === "SUCCESS") return assetUrl(assets.draw);
    if (gameState === "REVERSAL") return assetUrl(assets.reversal);
    if (gameState === "END") return assetUrl(assets.end);
    return null;
  }, [gameState, spreadId]);

  const runReading = useCallback(async () => {
    if (!spread || readingRequested.current) return;
    readingRequested.current = true;
    setIsLoadingReading(true);
    setReadingError(null);
    try {
      const response = await generateTarotReading({
        data: {
          spread: `${spread.title}（${spread.subtitle}）`,
          cards: drawnCards.map((card) => ({
            position: card.position,
            name: card.name,
            state: card.state,
          })),
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

  useEffect(() => {
    if (gameState === "DRAWING" && isDrawComplete) setGameState("SUCCESS");
  }, [gameState, isDrawComplete]);

  useEffect(() => {
    if (gameState !== "SUCCESS") return;
    const id = window.setTimeout(() => setGameState("REVERSAL"), 1500);
    return () => window.clearTimeout(id);
  }, [gameState]);

  const goToEnd = useCallback(() => {
    setGameState("END");
    void runReading();
  }, [runReading]);

  const resetSelection = useCallback(() => {
    selectedRef.current = [];
    setSelectedIds([]);
    setDrawnCards([]);
  }, []);

  const chooseSpread = useCallback((next: SpreadId) => {
    setSpreadId(next);
    setDeck(createSessionDeck());
    resetSelection();
    setReading(null);
    setReadingError(null);
    readingRequested.current = false;
    setGameState("SHUFFLE");
  }, [resetSelection]);

  const finishShuffle = useCallback(() => {
    setDeck(createSessionDeck());
    resetSelection();
    setGameState("DRAWING");
  }, [resetSelection]);

  const drawCard = useCallback(
    (card: SessionDeckCard) => {
      if (!spread) return;
      const current = selectedRef.current;
      if (current.includes(card.instanceId)) return;
      if (current.length >= spread.positions.length) return;
      const nextIndex = current.length;
      const next = [...current, card.instanceId];
      selectedRef.current = next;
      setSelectedIds(next);
      setDrawnCards((prev) => [
        ...prev,
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
    resetSelection();
    setReading(null);
    setReadingError(null);
    setIsLoadingReading(false);
    readingRequested.current = false;
    setGameState("MENU");
  }, [resetSelection]);

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
          resetSelection();
          return "SHUFFLE";
        case "END":
          return "REVERSAL";
        default:
          return current;
      }
    });
  }, [resetSelection]);

  useEffect(() => {
    const handler = () => goBack();
    window.addEventListener("gesture:back", handler as EventListener);
    return () => window.removeEventListener("gesture:back", handler as EventListener);
  }, [goBack]);

  return (
    <div className="sm-root">
      {gameState !== "MENU" && (
        <GlobalBackButton
          onBack={gameState === "END" ? resetAll : goBack}
          label={gameState === "END" ? "重新占卜" : "返回"}
        />
      )}

      <div className="sm-stage">
        {baseImage && (
          <img className="sm-base" src={baseImage} alt="" draggable={false} aria-hidden="true" />
        )}

        <AnimatePresence mode="wait">
          {gameState === "MENU" && (
            <MenuOverlay key="menu" onStart={() => setGameState("SPREAD_SELECTION")} />
          )}
          {gameState === "SPREAD_SELECTION" && (
            <SpreadOverlay key="spreads" onChoose={chooseSpread} />
          )}
          {gameState === "SHUFFLE" && <ShuffleStage key="shuffle" onDone={finishShuffle} />}
          {gameState === "DRAWING" && spreadId && (
            <DrawingStage
              key={`drawing-${spreadId}`}
              spreadId={spreadId}
              drawnCards={drawnCards}
              railDeck={railDeck}
              onDraw={drawCard}
              locked={isDrawComplete}
            />
          )}
          {gameState === "SUCCESS" && spreadId && (
            <SuccessStage key={`success-${spreadId}`} spreadId={spreadId} drawnCards={drawnCards} />
          )}
          {gameState === "REVERSAL" && spreadId && (
            <ReversalStage
              key={`reversal-${spreadId}`}
              spreadId={spreadId}
              drawnCards={drawnCards}
              onRevealed={goToEnd}
            />
          )}
          {gameState === "END" && spread && (
            <EndStage
              key={`end-${spread.id}`}
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

function GlobalBackButton({ onBack, label }: { onBack: () => void; label: string }) {
  return (
    <button type="button" className="sm-back" onClick={onBack} data-gesture aria-label={label}>
      <ChevronLeft className="size-5" />
      <span>{label}</span>
    </button>
  );
}

function MenuOverlay({ onStart }: { onStart: () => void }) {
  return (
    <motion.div className="sm-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
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

function SpreadOverlay({ onChoose }: { onChoose: (id: SpreadId) => void }) {
  const panels: Array<{ id: SpreadId; left: string }> = [
    { id: "one", left: "24.5%" },
    { id: "three", left: "50%" },
    { id: "five", left: "75.3%" },
  ];

  return (
    <motion.div className="sm-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
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

function ShuffleStage({ onDone }: { onDone: () => void }) {
  const { pointerRef } = useGesture();
  const [energy, setEnergy] = useState(0);
  const doneRef = useRef(false);
  const prevRef = useRef<{ x: number; y: number; angle: number | null; turns: number }>({
    x: 0,
    y: 0,
    angle: null,
    turns: 0,
  });
  const cards = useMemo(
    () =>
      Array.from({ length: 24 }, (_, index) => ({
        id: index,
        offsetX: (Math.random() - 0.5) * 24,
        offsetY: (Math.random() - 0.5) * 28,
        rotate: (Math.random() - 0.5) * 16,
      })),
    [],
  );

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setEnergy(1.25);
    window.setTimeout(onDone, 900);
  }, [onDone]);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const point = pointerRef.current;
      const state = prevRef.current;
      if (!state.x && !state.y) {
        state.x = point.x;
        state.y = point.y;
      }
      const dx = point.x - state.x;
      const dy = point.y - state.y;
      state.x = point.x;
      state.y = point.y;
      const speed = Math.hypot(dx, dy);
      const centerX = window.innerWidth * 0.5;
      const centerY = window.innerHeight * 0.5;
      const angle = Math.atan2(point.y - centerY, point.x - centerX);

      if ((point.handActive || point.down) && speed > 1.2) {
        if (state.angle !== null) {
          let delta = angle - state.angle;
          if (delta > Math.PI) delta -= Math.PI * 2;
          if (delta < -Math.PI) delta += Math.PI * 2;
          state.turns += Math.abs(delta);
        }
        state.angle = angle;
        setEnergy((value) => Math.min(1, value * 0.84 + Math.min(speed / 18, 0.35)));
        if (state.turns > Math.PI * 4.5) finish();
      } else {
        state.angle = null;
        setEnergy((value) => Math.max(0, value * 0.94 - 0.01));
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [finish, pointerRef]);

  return (
    <motion.div className="sm-layer sm-shuffle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="sm-pile" aria-hidden="true">
        {cards.map((card, index) => (
          <motion.img
            key={card.id}
            src={BACK_SRC}
            alt=""
            draggable={false}
            className="sm-pile-card"
            animate={{
              x: card.offsetX * (1 + energy * 4.2),
              y: card.offsetY * (1 + energy * 3.8),
              rotate: card.rotate * (1 + energy * 2.4),
              scale: 1 + energy * 0.06,
            }}
            transition={{ ...spring, delay: index * 0.008 }}
            style={{ zIndex: 24 - index }}
          />
        ))}
      </div>
      <Hotspot label="完成洗牌" left="50%" top="92%" width="14%" height="7%" onClick={finish} />
    </motion.div>
  );
}

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
  const poolWrapRef = useRef<HTMLDivElement | null>(null);
  const poolX = useMotionValue(0);
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const draggingRailRef = useRef(false);
  const lockedRef = useRef(locked);
  lockedRef.current = locked;

  const minPoolX = useCallback(() => {
    const wrap = poolWrapRef.current;
    if (!wrap) return 0;
    const content = Array.from(wrap.querySelectorAll<HTMLElement>(".sm-pool-card")).reduce(
      (sum, el) => sum + el.offsetWidth + 8,
      0,
    );
    return Math.min(0, wrap.clientWidth - content - 32);
  }, []);

  const findCardAt = useCallback((x: number, y: number): SessionDeckCard | null => {
    let best: SessionDeckCard | null = null;
    let bestZ = -Infinity;
    for (const card of railDeck) {
      const el = cardRefs.current.get(card.instanceId);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        const z = Number.parseInt(window.getComputedStyle(el).zIndex, 10);
        const zValue = Number.isFinite(z) ? z : 0;
        if (zValue >= bestZ) {
          best = card;
          bestZ = zValue;
        }
      }
    }
    return best;
  }, [railDeck]);

  useEffect(() => {
    let raf = 0;
    let lastX: number | null = null;
    let pinchPrev = false;
    let cooldown = 0;

    const loop = () => {
      const point = pointerRef.current;
      const now = performance.now();

      if (point.handActive && !lockedRef.current) {
        if (!point.down) {
          if (lastX !== null) {
            const dx = point.x - lastX;
            if (Math.abs(dx) > 0.5) {
              const next = Math.max(minPoolX(), Math.min(0, poolX.get() + dx));
              poolX.set(next);
            }
          }
          lastX = point.x;
          pinchPrev = false;
        } else {
          if (!pinchPrev && now > cooldown) {
            const card = findCardAt(point.x, point.y);
            if (card) {
              onDraw(card);
              cooldown = now + 420;
            }
          }
          pinchPrev = true;
          lastX = null;
        }
      } else {
        lastX = null;
        pinchPrev = false;
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [findCardAt, minPoolX, onDraw, pointerRef, poolX]);

  return (
    <motion.div className="sm-layer sm-draw" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="sm-slot-layer" aria-hidden="true">
        {SLOT_LAYOUTS[spreadId].map((slot, index) => {
          const card = drawnCards[index];
          return (
            <div
              key={`${spreadId}-slot-${index}`}
              className="sm-slot-card-wrap"
              style={{ left: slot.left, top: slot.top, width: slot.width }}
            >
              <AnimatePresence>
                {card && (
                  <motion.img
                    key={card.position}
                    src={BACK_SRC}
                    alt="已选择的卡牌"
                    className="sm-slot-card"
                    draggable={false}
                    initial={{ opacity: 0, y: 86, scale: 0.68 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={spring}
                  />
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {!locked && (
        <div className="sm-pool-wrap" ref={poolWrapRef} aria-label={`${SPREADS[spreadId].title} 牌堆`}>
          <motion.div
            className="sm-pool"
            style={{ x: poolX }}
            drag="x"
            dragConstraints={poolWrapRef}
            dragElastic={0.04}
            dragMomentum
            onDragStart={() => {
              draggingRailRef.current = true;
            }}
            onDragEnd={() => {
              window.setTimeout(() => {
                draggingRailRef.current = false;
              }, 100);
            }}
          >
            {railDeck.map((card, index) => (
              <motion.button
                key={card.instanceId}
                type="button"
                ref={(el) => {
                  if (el) cardRefs.current.set(card.instanceId, el);
                  else cardRefs.current.delete(card.instanceId);
                }}
                className="sm-pool-card"
                drag="y"
                dragConstraints={{ top: -160, bottom: 0 }}
                dragElastic={{ top: 0.16, bottom: 0.04 }}
                dragMomentum={false}
                data-gesture-ignore
                onClick={() => {
                  if (draggingRailRef.current) return;
                  onDraw(card);
                }}
                onDragEnd={(_, info) => {
                  if (info.offset.y < -50) onDraw(card);
                }}
                whileDrag={{ scale: 1.06, zIndex: 300 }}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ ...spring, delay: index * 0.005 }}
                style={{ zIndex: railDeck.length - index }}
              >
                <img src={BACK_SRC} alt="卡背" draggable={false} />
              </motion.button>
            ))}
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

function SuccessStage({ spreadId, drawnCards }: { spreadId: SpreadId; drawnCards: DrawnCard[] }) {
  return (
    <motion.div className="sm-layer sm-success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {SLOT_LAYOUTS[spreadId].map((slot, index) => {
        const card = drawnCards[index];
        if (!card) return null;
        return (
          <div
            key={`success-${card.position}`}
            className="sm-slot-card-wrap"
            style={{ left: slot.left, top: slot.top, width: slot.width }}
          >
            <motion.img
              src={BACK_SRC}
              alt="已完成抽取"
              className="sm-slot-card"
              draggable={false}
              initial={{ opacity: 0.7, scale: 0.94 }}
              animate={{ opacity: [0.7, 1, 1], scale: [0.94, 1.04, 1] }}
              transition={{ duration: 1.3, ease: "easeOut" }}
            />
          </div>
        );
      })}
    </motion.div>
  );
}

function ReversalStage({
  spreadId,
  drawnCards,
  onRevealed,
}: {
  spreadId: SpreadId;
  drawnCards: DrawnCard[];
  onRevealed: () => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const flippedRef = useRef(false);

  const triggerReveal = useCallback(() => {
    if (flippedRef.current) return;
    flippedRef.current = true;
    setFlipped(true);
    window.setTimeout(onRevealed, 950);
  }, [onRevealed]);

  return (
    <motion.div className="sm-layer sm-reversal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {SLOT_LAYOUTS[spreadId].map((slot, index) => {
        const card = drawnCards[index];
        if (!card) return null;
        return (
          <div
            key={`reversal-${card.position}`}
            className="sm-reversal-card-wrap"
            style={{ left: slot.left, top: slot.top, width: slot.width }}
          >
            <motion.div
              className="sm-reversal-card"
              animate={{ rotateY: flipped ? 180 : 0 }}
              transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1], delay: index * 0.06 }}
            >
              <div className="sm-reversal-face sm-reversal-front">
                <img src={BACK_SRC} alt="卡背" className="sm-slot-card" draggable={false} />
              </div>
              <div className="sm-reversal-face sm-reversal-back">
                <img
                  src={getCardFrontPath(card.number)}
                  alt={`${card.name}${card.state}`}
                  className={cn("sm-slot-card", card.state === "逆位" && "is-reversed")}
                  draggable={false}
                />
              </div>
            </motion.div>
          </div>
        );
      })}

      {!flipped && (
        <Hotspot label="点击揭晓" left="50%" top="86%" width="28%" height="13%" onClick={triggerReveal} />
      )}
    </motion.div>
  );
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
  reading: ReadingResult | null;
  isLoading: boolean;
  error: string | null;
  onReset: () => void;
}) {
  const { pointerRef } = useGesture();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let raf = 0;
    let lastY: number | null = null;

    const loop = () => {
      const point = pointerRef.current;
      const el = scrollRef.current;
      if (el && point.handActive && !point.down) {
        if (lastY !== null) {
          const dy = point.y - lastY;
          if (Math.abs(dy) > 1) el.scrollBy({ top: dy * 2.2 });
        }
        lastY = point.y;
      } else {
        lastY = null;
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [pointerRef]);

  return (
    <motion.div className="sm-layer sm-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="sm-end-scroll" ref={scrollRef}>
        <div className="sm-end-copy">
          <p className="sm-end-kicker">{spread.title}</p>
          <button type="button" className="sm-reset-inline" onClick={onReset} data-gesture>
            <RotateCcw className="size-4" />
            <span>重新占卜</span>
          </button>

          <div className="sm-end-cards-text">
            {drawnCards.map((card) => (
              <p key={card.position}>
                <strong>{card.position}</strong>
                <span>
                  {card.name} · {card.state}
                </span>
              </p>
            ))}
          </div>

          <div className="sm-end-reading-block">
            <p className="sm-end-summary">
              {isLoading ? "正在召唤解读……" : error ? error : (reading?.summary ?? "")}
            </p>

            {drawnCards.map((card) => {
              const item = reading?.perCard.find((entry) => entry.position === card.position);
              return (
                <section key={card.position} className="sm-end-reading-item">
                  <h2>{item?.title ?? `${card.position}｜${card.name} · ${card.state}`}</h2>
                  <p>{item?.text ?? (isLoading ? "" : "—")}</p>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Hotspot({
  label,
  left,
  top,
  width,
  height,
  onClick,
  muted,
}: {
  label: string;
  left: string;
  top: string;
  width: string;
  height: string;
  onClick: () => void;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn("sm-hotspot", muted && "is-muted")}
      style={{ left, top, width, height }}
      onClick={onClick}
      aria-label={label}
      data-gesture
    />
  );
}
