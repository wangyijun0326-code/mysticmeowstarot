import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
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
        content: "沉浸式猫咪塔罗抽牌体验，含手势洗牌、揭牌仪式与 AI 中性深度解读。",
      },
      { property: "og:title", content: "猫咪塔罗 Web App" },
      {
        property: "og:description",
        content: "沉浸式猫咪塔罗抽牌体验，含手势洗牌、揭牌仪式与 AI 中性深度解读。",
      },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Index,
});

/** Application state machine. Each state binds to a design screenshot. */
type GameState = "MENU" | "SPREAD_SELECTION" | "SHUFFLE" | "DRAWING" | "REVEAL";

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
  const [successFlash, setSuccessFlash] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [reading, setReading] = useState<
    { summary: string; perCard: Array<{ position: string; title: string; text: string }> } | null
  >(null);
  const [isLoadingReading, setIsLoadingReading] = useState(false);
  const [readingError, setReadingError] = useState<string | null>(null);

  const spread = spreadId ? SPREADS[spreadId] : null;
  const requiredCount = spread?.positions.length ?? 0;
  const isDrawComplete = requiredCount > 0 && drawnCards.length === requiredCount;

  const railDeck = useMemo(
    () => deck.filter((card) => !selectedIds.includes(card.instanceId)).slice(0, 16),
    [deck, selectedIds],
  );

  // The screenshot bound to the current state (null => CSS dark result stage).
  const baseImage = useMemo(() => {
    if (gameState === "MENU") return assetUrl("menu.png");
    if (gameState === "SPREAD_SELECTION") return assetUrl("spreads.png");
    if (gameState === "SHUFFLE") return assetUrl("wash.png");
    if (gameState === "DRAWING" && spreadId) {
      return assetUrl(successFlash ? SPREAD_ASSETS[spreadId].success : SPREAD_ASSETS[spreadId].draw);
    }
    if (gameState === "REVEAL" && spreadId && !revealed) {
      return assetUrl(SPREAD_ASSETS[spreadId].reversal);
    }
    return null;
  }, [gameState, spreadId, successFlash, revealed]);

  // When enough cards are drawn, flash the "success" screenshot, then move to reveal.
  useEffect(() => {
    if (gameState !== "DRAWING" || !isDrawComplete) return;
    setSuccessFlash(true);
    const id = window.setTimeout(() => {
      setSuccessFlash(false);
      setRevealed(false);
      setGameState("REVEAL");
    }, 1200);
    return () => window.clearTimeout(id);
  }, [gameState, isDrawComplete]);

  const chooseSpread = (next: SpreadId) => {
    setSpreadId(next);
    setDeck(createSessionDeck());
    setSelectedIds([]);
    setDrawnCards([]);
    setReading(null);
    setReadingError(null);
    setSuccessFlash(false);
    setRevealed(false);
    setGameState("SHUFFLE");
  };

  const finishShuffle = useCallback(() => {
    setDeck(createSessionDeck());
    setGameState("DRAWING");
  }, []);

  const drawCard = (card: SessionDeckCard) => {
    if (!spread || gameState !== "DRAWING" || successFlash || isDrawComplete) return;
    if (selectedIds.includes(card.instanceId)) return;
    const nextIndex = drawnCards.length;
    setSelectedIds((c) => [...c, card.instanceId]);
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
  };

  const revealNow = async () => {
    if (!spread || revealed) return;
    setRevealed(true);
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
  };

  const resetAll = () => {
    setSpreadId(null);
    setDeck(createSessionDeck());
    setSelectedIds([]);
    setDrawnCards([]);
    setReading(null);
    setReadingError(null);
    setIsLoadingReading(false);
    setSuccessFlash(false);
    setRevealed(false);
    setGameState("MENU");
  };

  const showResult = gameState === "REVEAL" && revealed;

  return (
    <div className="sm-root">
      {showResult && spread && spreadId ? (
        <RevealResult
          spreadId={spreadId}
          drawnCards={drawnCards}
          reading={reading}
          isLoading={isLoadingReading}
          error={readingError}
          onReset={resetAll}
        />
      ) : (
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
            {gameState === "SHUFFLE" && <ShuffleOverlay key="shuffle" onDone={finishShuffle} />}
            {gameState === "DRAWING" && spreadId && (
              <DrawingOverlay
                key="drawing"
                spreadId={spreadId}
                drawnCards={drawnCards}
                railDeck={railDeck}
                onDraw={drawCard}
                locked={successFlash}
              />
            )}
            {gameState === "REVEAL" && !revealed && (
              <RevealBackOverlay key="reveal-back" onReveal={revealNow} />
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
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

/* --------------------------------------------------------------- SHUFFLE */

function ShuffleOverlay({ onDone }: { onDone: () => void }) {
  const [handMode, setHandMode] = useState(false);
  const { videoRef, status, cursor } = useHandTracking(handMode);
  const [shuffling, setShuffling] = useState(false);
  const pointsRef = useRef<Array<{ x: number; y: number; t: number }>>([]);
  const doneRef = useRef(false);

  const startShuffle = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setShuffling(true);
    window.setTimeout(onDone, 1500);
  }, [onDone]);

  // Detect a circular "wash" motion of the hand over the pile region.
  useEffect(() => {
    if (!handMode || !cursor.active || doneRef.current) return;
    const inPile = cursor.x > 0.06 && cursor.x < 0.94 && cursor.y > 0.34 && cursor.y < 0.92;
    if (!inPile) {
      pointsRef.current = [];
      return;
    }
    const now = performance.now();
    const pts = pointsRef.current;
    pts.push({ x: cursor.x, y: cursor.y, t: now });
    while (pts.length && now - pts[0].t > 1600) pts.shift();
    if (pts.length > 10) {
      const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
      let total = 0;
      for (let i = 1; i < pts.length; i += 1) {
        const a1 = Math.atan2(pts[i - 1].y - cy, pts[i - 1].x - cx);
        const a2 = Math.atan2(pts[i].y - cy, pts[i].x - cx);
        let d = a2 - a1;
        if (d > Math.PI) d -= 2 * Math.PI;
        if (d < -Math.PI) d += 2 * Math.PI;
        total += d;
      }
      if (Math.abs(total) > Math.PI * 2.2) {
        pointsRef.current = [];
        startShuffle();
      }
    }
  }, [cursor, handMode, startShuffle]);

  return (
    <motion.div
      className="sm-layer"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Soft shimmer over the pile while shuffling */}
      <AnimatePresence>
        {shuffling && (
          <motion.div
            className="sm-shuffle-glow"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.85, 0.4, 0.9, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, times: [0, 0.25, 0.5, 0.75, 1] }}
          />
        )}
      </AnimatePresence>

      {/* Tap-to-shuffle paw hotspot baked into wash.png */}
      <Hotspot
        label="洗牌"
        left="50%"
        top="83.5%"
        width="12%"
        height="15%"
        onClick={startShuffle}
        round
      />

      {/* Virtual cursor from hand tracking */}
      {handMode && cursor.active && (
        <motion.div
          className="sm-cursor"
          style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%` }}
          animate={{ scale: shuffling ? 1.4 : 1 }}
        />
      )}

      {/* Gesture control panel */}
      <div className="sm-shuffle-controls">
        <video
          ref={videoRef}
          className={cn("sm-cam", !handMode && "is-hidden")}
          playsInline
          muted
        />
        <button type="button" className="sm-pill" onClick={() => setHandMode((v) => !v)}>
          {handMode ? "关闭手势" : "开启手势洗牌"}
        </button>
        <p className="sm-status">{handStatus(handMode, status, shuffling)}</p>
      </div>
    </motion.div>
  );
}

function handStatus(
  handMode: boolean,
  status: ReturnType<typeof useHandTracking>["status"],
  shuffling: boolean,
) {
  if (shuffling) return "✦ 牌灵流动中……";
  if (!handMode) return "点击爪印洗牌，或开启手势在牌堆上方画圈搓牌";
  switch (status) {
    case "requesting":
      return "正在请求摄像头权限……";
    case "loading":
      return "正在载入手势模型……";
    case "tracking":
      return "已连接：在牌堆上方用手画圈搓牌";
    case "denied":
      return "摄像头被拒绝，可直接点击爪印洗牌";
    case "error":
      return "手势不可用，可直接点击爪印洗牌";
    default:
      return "准备中……";
  }
}

/* --------------------------------------------------------------- DRAWING */

function DrawingOverlay({
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
  const slots = SLOT_LAYOUTS[spreadId];
  return (
    <motion.div
      className="sm-layer"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Drawn cards fly into their slots (face down) */}
      {slots.map((slot, index) => {
        const card = drawnCards[index];
        if (!card) return null;
        return (
          <motion.div
            key={index}
            className="sm-slot"
            style={{ left: slot.left, top: slot.top }}
            initial={{ opacity: 0, y: 60, scale: 0.7 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={spring}
          >
            <img src={BACK_SRC} alt="已抽取的牌背面" draggable={false} />
          </motion.div>
        );
      })}

      {/* Interactive deck rail along the bottom strip of the screenshot */}
      {!locked && (
        <div className="sm-deck">
          {railDeck.map((card) => (
            <motion.button
              key={card.instanceId}
              type="button"
              className="sm-deck-card"
              whileHover={{ y: -18, scale: 1.07 }}
              whileTap={{ scale: 0.96 }}
              transition={spring}
              onClick={() => onDraw(card)}
              aria-label="抽一张牌"
            >
              <img src={BACK_SRC} alt="" draggable={false} />
            </motion.button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

/* ----------------------------------------------------------- REVEAL BACK */

function RevealBackOverlay({ onReveal }: { onReveal: () => void }) {
  return (
    <motion.button
      type="button"
      className="sm-reveal-hit"
      onClick={onReveal}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      aria-label="翻开牌面"
    >
      <motion.span
        className="sm-reveal-hint"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.8, repeat: Number.POSITIVE_INFINITY }}
      >
        TAP TO REVEAL
      </motion.span>
    </motion.button>
  );
}

/* --------------------------------------------------------- REVEAL RESULT */

function RevealResult({
  spreadId,
  drawnCards,
  reading,
  isLoading,
  error,
  onReset,
}: {
  spreadId: SpreadId;
  drawnCards: DrawnCard[];
  reading:
    | { summary: string; perCard: Array<{ position: string; title: string; text: string }> }
    | null;
  isLoading: boolean;
  error: string | null;
  onReset: () => void;
}) {
  const spread = SPREADS[spreadId];
  return (
    <motion.section
      className="sm-result"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
    >
      <header className="sm-result-head">
        <p className="sm-kicker">{spread.title}</p>
        <h1>{spread.interpretationTitle}</h1>
        <p className="sm-sub">{spread.revealPrompt === spread.revealPrompt ? spread.subtitle : ""}</p>
        <button type="button" className="sm-pill" onClick={onReset}>
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
            transition={{ ...spring, delay: index * 0.16 }}
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
    </motion.section>
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
    <motion.button
      type="button"
      className={cn("sm-hotspot", round && "is-round", muted && "is-muted")}
      style={{ left, top, width, height }}
      onClick={onClick}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      aria-label={label}
    />
  );
}
