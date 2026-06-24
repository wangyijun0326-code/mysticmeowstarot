import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Stars, RotateCcw, WandSparkles } from "lucide-react";
import menuAsset from "@/assets/tarot-menu.png.asset.json";
import spreadsAsset from "@/assets/tarot-spreads.png.asset.json";
import washAsset from "@/assets/tarot-wash.png.asset.json";
import oneCardAsset from "@/assets/tarot-one-card.png.asset.json";
import oneCardSuccessAsset from "@/assets/tarot-one-card-success.png.asset.json";
import oneCardRevealAsset from "@/assets/tarot-one-card-reversal.png.asset.json";
import threeCardsAsset from "@/assets/uploaded/three_cards.png.asset.json";
import threeCardsSuccessAsset from "@/assets/uploaded/three_cards_success.png.asset.json";
import threeCardsRevealAsset from "@/assets/uploaded/three_cards_reversal.png.asset.json";
import threeCardsEndAsset from "@/assets/uploaded/three-end.png.asset.json";
import fiveCardsAsset from "@/assets/uploaded/five_cards.png.asset.json";
import fiveCardsSuccessAsset from "@/assets/uploaded/five_cards_success.png.asset.json";
import fiveCardsEndAsset from "@/assets/uploaded/five-end.png.asset.json";
import fiveCardsRevealAsset from "@/assets/uploaded/five_cards_reversal.png.asset.json";
import oneCardEndAsset from "@/assets/uploaded/one-end.png.asset.json";
import backAsset from "@/assets/tarot-back.png.asset.json";
import { Button } from "@/components/ui/button";
import {
  SPREADS,
  SLOT_LAYOUTS,
  createSessionDeck,
  getCardBackPath,
  getCardFrontPath,
  getStageReferencePath,
  type DrawnCard,
  type SpreadId,
} from "@/lib/tarot";
import { generateTarotReading } from "@/lib/tarot-reading.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "猫咪塔罗 Web App" },
      {
        name: "description",
        content: "沉浸式猫咪塔罗抽牌体验，含洗牌、揭牌仪式与 AI 深度解读。",
      },
      { property: "og:title", content: "猫咪塔罗 Web App" },
      {
        property: "og:description",
        content: "沉浸式猫咪塔罗抽牌体验，含洗牌、揭牌仪式与 AI 深度解读。",
      },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Index,
});

type Stage = "home" | "spreads" | "shuffle" | "draw" | "reveal" | "reading";

type SessionDeckCard = ReturnType<typeof createSessionDeck>[number];

const spring = { type: "spring", stiffness: 180, damping: 22, mass: 0.8 } as const;
const floatSpring = { type: "spring", stiffness: 220, damping: 18, mass: 0.7 } as const;

const PREVIEW_BACKGROUNDS = {
  home: menuAsset.url,
  spreads: spreadsAsset.url,
  shuffle: washAsset.url,
  daily: {
    draw: oneCardAsset.url,
    drawFilled: oneCardSuccessAsset.url,
    reveal: oneCardEndAsset.url,
    reading: oneCardEndAsset.url,
  },
  three: {
    draw: threeCardsAsset.url,
    drawFilled: threeCardsSuccessAsset.url,
    reveal: threeCardsRevealAsset.url,
    reading: threeCardsEndAsset.url,
  },
  either: {
    draw: fiveCardsAsset.url,
    drawFilled: fiveCardsSuccessAsset.url,
    reveal: fiveCardsRevealAsset.url,
    reading: fiveCardsEndAsset.url,
  },
};

function Index() {
  const [stage, setStage] = useState<Stage>("home");
  const [spreadId, setSpreadId] = useState<SpreadId | null>(null);
  const [deck, setDeck] = useState<SessionDeckCard[]>(() => createSessionDeck());
  const [dragEnergy, setDragEnergy] = useState(0);
  const [drawnCards, setDrawnCards] = useState<DrawnCard[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [revealIndex, setRevealIndex] = useState<number>(-1);
  const [showRevealGlow, setShowRevealGlow] = useState(false);
  const [reading, setReading] = useState<{ summary: string; perCard: Array<{ position: string; title: string; text: string }> } | null>(null);
  const [typedSummary, setTypedSummary] = useState("");
  const [typedCards, setTypedCards] = useState<Record<string, string>>({});
  const [isLoadingReading, setIsLoadingReading] = useState(false);
  const [readingError, setReadingError] = useState<string | null>(null);
  const timeoutsRef = useRef<number[]>([]);

  const spread = spreadId ? SPREADS[spreadId] : null;
  const requiredCount = spread?.positions.length ?? 0;
  const isDrawComplete = requiredCount > 0 && drawnCards.length === requiredCount;
  const canReveal = stage === "draw" && isDrawComplete;

  const bottomDeck = useMemo(
    () => deck.filter((card) => !selectedIds.includes(card.instanceId)).slice(0, 18),
    [deck, selectedIds],
  );

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
    };
  }, []);

  useEffect(() => {
    if (stage !== "reading" || !reading) return;

    setTypedSummary("");
    setTypedCards({});

    const schedule = (callback: () => void, delay: number) => {
      const id = window.setTimeout(callback, delay);
      timeoutsRef.current.push(id);
      return id;
    };

    Array.from(reading.summary).forEach((_, index) => {
      schedule(() => {
        setTypedSummary(reading.summary.slice(0, index + 1));
      }, index * 16);
    });

    const summaryDoneAt = reading.summary.length * 16 + 220;
    let runningOffset = summaryDoneAt;

    reading.perCard.forEach((item) => {
      Array.from(item.text).forEach((_, charIndex) => {
        schedule(() => {
          setTypedCards((current) => ({
            ...current,
            [item.position]: item.text.slice(0, charIndex + 1),
          }));
        }, runningOffset + charIndex * 14);
      });
      runningOffset += item.text.length * 14 + 180;
    });
  }, [reading, stage]);

  const startJourney = () => {
    setStage("spreads");
  };

  const chooseSpread = (nextSpread: SpreadId) => {
    setSpreadId(nextSpread);
    setDeck(createSessionDeck());
    setSelectedIds([]);
    setDrawnCards([]);
    setRevealIndex(-1);
    setReading(null);
    setTypedSummary("");
    setTypedCards({});
    setReadingError(null);
    setStage("shuffle");
  };

  const finishShuffle = () => {
    setStage("draw");
  };

  const drawCard = (card: SessionDeckCard) => {
    if (!spread || stage !== "draw" || isDrawComplete || selectedIds.includes(card.instanceId)) return;

    const nextIndex = drawnCards.length;
    const nextCard: DrawnCard = {
      number: card.number,
      name: card.name,
      state: card.state,
      position: spread.positions[nextIndex],
      slotIndex: nextIndex,
    };

    setSelectedIds((current) => [...current, card.instanceId]);
    setDrawnCards((current) => [...current, nextCard]);
  };

  const revealCards = async () => {
    if (!spread || !isDrawComplete) return;

    setStage("reveal");
    setShowRevealGlow(true);
    for (let index = 0; index < drawnCards.length; index += 1) {
      await wait(460);
      setRevealIndex(index);
    }
    await wait(480);
    setShowRevealGlow(false);
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
      setStage("reading");
    } catch (error) {
      setReadingError(error instanceof Error ? error.message : "解读生成失败");
      setStage("reading");
    } finally {
      setIsLoadingReading(false);
    }
  };

  const resetAll = () => {
    timeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
    timeoutsRef.current = [];
    setDeck(createSessionDeck());
    setSpreadId(null);
    setSelectedIds([]);
    setDrawnCards([]);
    setRevealIndex(-1);
    setShowRevealGlow(false);
    setReading(null);
    setTypedSummary("");
    setTypedCards({});
    setReadingError(null);
    setIsLoadingReading(false);
    setDragEnergy(0);
    setStage("home");
  };

  const previewBackground = getPreviewBackground(stage, spreadId, drawnCards.length > 0);
  const previewReference = getStageReferencePath(
    stage === "reading" ? "reveal" : stage === "reveal" ? "reveal" : stage === "draw" ? "draw" : stage,
    spreadId,
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="tarot-page-shell">
        <div className="tarot-stage-frame">
          <ReferenceBackdrop src={previewBackground} stage={stage} />
          <div className="tarot-vignette" aria-hidden="true" />
          <div className="tarot-noise" aria-hidden="true" />
          <TarotBorder />

          <div className="tarot-stage-content">
            <TarotNav />

            <AnimatePresence mode="wait">
              {stage === "home" && <HomeStage key="home" onStart={startJourney} />}
              {stage === "spreads" && <SpreadStage key="spreads" onChoose={chooseSpread} />}
              {stage === "shuffle" && (
                <ShuffleStage
                  key="shuffle"
                  dragEnergy={dragEnergy}
                  onDragEnergy={setDragEnergy}
                  onDone={finishShuffle}
                />
              )}
              {(stage === "draw" || stage === "reveal" || stage === "reading") && spread && (
                <DrawStage
                  key="draw-stage"
                  stage={stage}
                  spreadId={spread.id}
                  drawnCards={drawnCards}
                  revealIndex={revealIndex}
                  bottomDeck={bottomDeck}
                  onDraw={drawCard}
                  onReveal={revealCards}
                  canReveal={canReveal}
                  isRevealGlowVisible={showRevealGlow}
                  reading={reading}
                  typedSummary={typedSummary}
                  typedCards={typedCards}
                  isLoadingReading={isLoadingReading}
                  readingError={readingError}
                  onReset={resetAll}
                />
              )}
            </AnimatePresence>
          </div>
        </div>

        <footer className="tarot-footer-meta">
          <span>参考图路径预留：{previewReference}</span>
          <span>卡背：/cat_tarot_78_single_cards/back.png</span>
        </footer>
      </main>
    </div>
  );
}

function HomeStage({ onStart }: { onStart: () => void }) {
  return (
    <motion.section
      className="tarot-home-stage"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      transition={spring}
    >
      <div className="tarot-home-title-wrap">
        <div className="tarot-home-sign">
          <h1 className="tarot-home-title">TAROT CARD READINGS</h1>
        </div>
      </div>

      <div className="tarot-home-actions">
        <PawButton label="START" icon={<Stars className="size-5" />} onClick={onStart} />
        <PawButton label="GUIDE" icon={<Sparkles className="size-5" />} disabled />
      </div>
    </motion.section>
  );
}

function SpreadStage({ onChoose }: { onChoose: (spread: SpreadId) => void }) {
  return (
    <motion.section
      className="tarot-spread-stage"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -18 }}
      transition={spring}
    >
      <StageHeading title="SPREADS" subtitle="CHOOSE A SPREAD TO BEGIN" />
      <div className="tarot-spread-grid">
        {(Object.keys(SPREADS) as SpreadId[]).map((spreadId) => {
          const spread = SPREADS[spreadId];
          return (
            <motion.button
              key={spreadId}
              type="button"
              className="tarot-spread-card"
              onClick={() => onChoose(spreadId)}
              whileHover={{ y: -10, scale: 1.02 }}
              whileTap={{ scale: 0.985 }}
              transition={floatSpring}
            >
              <div className="tarot-spread-card-header">{spread.title}</div>
              <div className="tarot-spread-card-preview">
                {spread.positions.map((_, index) => (
                  <div key={index} className={cn("tarot-spread-mini-card", `spread-${spreadId}-${index}`)} />
                ))}
              </div>
              <p className="tarot-spread-card-copy">{spread.guidance}</p>
            </motion.button>
          );
        })}
      </div>
    </motion.section>
  );
}

function ShuffleStage({
  dragEnergy,
  onDragEnergy,
  onDone,
}: {
  dragEnergy: number;
  onDragEnergy: (value: number) => void;
  onDone: () => void;
}) {
  const scatter = Array.from({ length: 18 }, (_, index) => ({
    id: index,
    rotate: (index % 6) * 5 - 12,
    x: ((index % 6) - 2.5) * 88,
    y: Math.floor(index / 6) * 22 - 24,
  }));

  return (
    <motion.section
      className="tarot-shuffle-stage"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -18 }}
      transition={spring}
    >
      <StageHeading title="SHUFFLE" subtitle="Let the cards wander." />

      <div className="tarot-shuffle-pile-wrap">
        <motion.div
          className="tarot-shuffle-pile"
          drag="x"
          dragConstraints={{ left: -160, right: 160 }}
          dragElastic={0.18}
          onDrag={(_, info) => onDragEnergy(Math.min(1, Math.abs(info.offset.x) / 150))}
          onDragEnd={() => onDragEnergy(0)}
          whileTap={{ scale: 1.02 }}
        >
          {scatter.map((card, index) => (
            <motion.div
              key={card.id}
              className="tarot-shuffle-card"
              animate={{
                x: card.x * (0.25 + dragEnergy * 0.85),
                y: card.y * (0.3 + dragEnergy * 0.9),
                rotate: card.rotate * (0.3 + dragEnergy * 0.95),
              }}
              transition={spring}
              style={{ zIndex: scatter.length - index }}
            >
              <TarotBackCard alt="洗牌中的塔罗牌背面" />
            </motion.div>
          ))}
          <div className="tarot-shuffle-stars" aria-hidden="true">
            {Array.from({ length: 18 }, (_, index) => (
              <motion.span
                key={index}
                className="tarot-star-dot"
                animate={{
                  opacity: [0.15, 0.9, 0.2],
                  x: [0, (index % 2 === 0 ? 12 : -12) * dragEnergy, 0],
                  y: [0, ((index % 3) - 1) * 16 * dragEnergy, 0],
                }}
                transition={{ duration: 1.6 + index * 0.04, repeat: Number.POSITIVE_INFINITY }}
                style={{ left: `${8 + (index % 6) * 16}%`, top: `${12 + Math.floor(index / 6) * 24}%` }}
              />
            ))}
          </div>
        </motion.div>
      </div>

      <div className="tarot-stage-bottom">
        <motion.div className="tarot-shuffle-prompt" animate={{ scale: dragEnergy > 0.1 ? 1.04 : 1 }}>
          <span className="tarot-paw-icon">🐾</span>
          <span>TAP TO SHUFFLE</span>
        </motion.div>
        <Button variant="ghost" className="tarot-primary-action" onClick={onDone}>
          洗牌完成
        </Button>
      </div>
    </motion.section>
  );
}

function DrawStage({
  stage,
  spreadId,
  drawnCards,
  revealIndex,
  bottomDeck,
  onDraw,
  onReveal,
  canReveal,
  isRevealGlowVisible,
  reading,
  typedSummary,
  typedCards,
  isLoadingReading,
  readingError,
  onReset,
}: {
  stage: Stage;
  spreadId: SpreadId;
  drawnCards: DrawnCard[];
  revealIndex: number;
  bottomDeck: SessionDeckCard[];
  onDraw: (card: SessionDeckCard) => void;
  onReveal: () => void;
  canReveal: boolean;
  isRevealGlowVisible: boolean;
  reading: { summary: string; perCard: Array<{ position: string; title: string; text: string }> } | null;
  typedSummary: string;
  typedCards: Record<string, string>;
  isLoadingReading: boolean;
  readingError: string | null;
  onReset: () => void;
}) {
  const spread = SPREADS[spreadId];
  const slots = SLOT_LAYOUTS[spreadId];
  const isRevealStage = stage === "reveal" || stage === "reading";

  return (
    <motion.section
      className="tarot-draw-stage"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={spring}
    >
      <StageHeading title={spread.title} subtitle={isRevealStage ? spread.revealPrompt : spread.guidance} />

      <LayoutGroup>
        <div className={cn("tarot-slot-field", `field-${spreadId}`)}>
          {slots.map((slot, index) => {
            const card = drawnCards[index];
            const revealed = revealIndex >= index;
            const isSingleFloating = spreadId === "daily" && !isRevealStage;
            const shouldGlow = isRevealGlowVisible && revealIndex === index;

            return (
              <motion.div
                key={index}
                className="tarot-slot-anchor"
                style={{ left: slot.left, top: slot.top }}
                initial={false}
                animate={{ scale: card ? 1 : 0.98, opacity: 1 }}
              >
                {!card && <div className="tarot-slot-placeholder" />}
                {card && (
                  <motion.div
                    layoutId={`card-${card.slotIndex}`}
                    className={cn("tarot-reveal-wrapper", shouldGlow && "is-glowing")}
                    animate={{ rotateY: revealed ? 180 : 0, rotateZ: card.state === "逆位" && revealed ? 180 : 0 }}
                    transition={{ ...spring, duration: 0.85 }}
                    style={{ transformStyle: "preserve-3d" }}
                  >
                    <div className="tarot-card-face tarot-card-face-back">
                      <TarotBackCard
                        alt={`${card.position} 的塔罗牌背面`}
                        className={cn(isSingleFloating && "tarot-card-floating")}
                      />
                    </div>
                    <div className="tarot-card-face tarot-card-face-front">
                      <TarotFrontCard
                        cardNumber={card.number}
                        alt={`${card.name}${card.state} 塔罗牌`}
                        className={cn(card.state === "逆位" && "rotate-180")}
                      />
                    </div>
                    {shouldGlow && <motion.div className="tarot-paw-burst" initial={{ opacity: 0, scale: 0.2 }} animate={{ opacity: [0, 1, 0], scale: [0.2, 1.1, 1.35] }} transition={{ duration: 0.7 }} />}
                  </motion.div>
                )}

                <div className="tarot-slot-caption">
                  <span>{spread.positions[index]}</span>
                  {isRevealStage && card ? (
                    <motion.div className="tarot-card-meta" initial={{ opacity: 0, y: 10 }} animate={{ opacity: revealed ? 1 : 0, y: revealed ? 0 : 10 }}>
                      <strong>{card.name}</strong>
                      <em>{card.state}</em>
                    </motion.div>
                  ) : null}
                </div>
              </motion.div>
            );
          })}
        </div>

        {!isRevealStage && (
          <div className="tarot-bottom-drawer">
            <div className="tarot-drawer-arrow">‹</div>
            <div className="tarot-card-rail" role="list" aria-label="可选择的卡牌列表">
              {bottomDeck.map((card, index) => (
                <motion.button
                  key={card.instanceId}
                  layoutId={`card-${drawnCards.length === 0 ? index : card.instanceId}`}
                  type="button"
                  className="tarot-rail-card"
                  whileHover={{ y: -10, scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  transition={floatSpring}
                  onClick={() => onDraw(card)}
                >
                  <TarotBackCard alt="待抽取的塔罗牌背面" />
                </motion.button>
              ))}
            </div>
            <div className="tarot-drawer-arrow">›</div>
          </div>
        )}
      </LayoutGroup>

      <div className="tarot-stage-bottom">
        {canReveal ? (
          <motion.button
            type="button"
            className="tarot-reveal-trigger"
            onClick={onReveal}
            initial={{ opacity: 0.3 }}
            animate={{ opacity: [0.6, 1, 0.6], boxShadow: ["0 0 0 0 var(--glow-soft)", "0 0 36px 4px var(--glow-strong)", "0 0 0 0 var(--glow-soft)"] }}
            transition={{ duration: 1.8, repeat: Number.POSITIVE_INFINITY }}
          >
            <WandSparkles className="size-4" />
            TAP TO REVEAL
          </motion.button>
        ) : !isRevealStage ? (
          <div className="tarot-guidance-line">Slide through the cards, then tap one to choose.</div>
        ) : null}
      </div>

      {stage === "reading" && (
        <div className="tarot-reading-panel">
          <div className="tarot-reading-header">
            <div>
              <p className="tarot-reading-kicker">AI DEEP READING</p>
              <h2>{spread.interpretationTitle}</h2>
            </div>
            <Button variant="ghost" className="tarot-primary-action" onClick={onReset}>
              <RotateCcw className="size-4" />
              重新占卜
            </Button>
          </div>

          <div className="tarot-reading-summary">
            {isLoadingReading ? "正在召唤解读……" : readingError ? readingError : typedSummary}
          </div>

          <div className={cn("tarot-reading-grid", `reading-${spreadId}`)}>
            {drawnCards.map((card) => {
              const item = reading?.perCard.find((entry) => entry.position === card.position);
              return (
                <article key={card.position} className="tarot-reading-card-copy">
                  <h3>{item?.title ?? `${card.name}｜${card.state}`}</h3>
                  <p>{typedCards[card.position] ?? ""}</p>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </motion.section>
  );
}

function StageHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="tarot-stage-heading">
      <div className="tarot-stage-heading-lines" aria-hidden="true" />
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </div>
  );
}

function TarotNav() {
  return (
    <header className="tarot-nav">
      <nav aria-label="Primary">
        <a href="#" className="is-active">
          HOME
        </a>
        <a href="#">ABOUT</a>
        <div className="tarot-nav-moon" aria-hidden="true">
          ☾
        </div>
        <a href="#">HISTORY</a>
        <a href="#">CONTACT</a>
      </nav>
    </header>
  );
}

function TarotBorder() {
  return (
    <div className="tarot-border" aria-hidden="true">
      <span className="corner top-left" />
      <span className="corner top-right" />
      <span className="corner bottom-left" />
      <span className="corner bottom-right" />
    </div>
  );
}

function PawButton({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <motion.button
      type="button"
      className="tarot-paw-button"
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? undefined : { y: -6, scale: 1.04 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      transition={floatSpring}
    >
      <span className="tarot-paw-outline" aria-hidden="true">
        <span className="toe toe-1" />
        <span className="toe toe-2" />
        <span className="toe toe-3" />
        <span className="toe toe-4" />
        <span className="pad" />
      </span>
      <span className="tarot-paw-label">{label}</span>
      <span className="tarot-paw-small">{icon}</span>
    </motion.button>
  );
}

function ReferenceBackdrop({ src, stage }: { src: string; stage: Stage }) {
  return (
    <AnimatePresence mode="wait">
      <motion.img
        key={`${stage}-${src}`}
        src={src}
        alt=""
        aria-hidden="true"
        className="tarot-reference-backdrop"
        initial={{ opacity: 0, scale: 1.02 }}
        animate={{ opacity: 0.36, scale: 1 }}
        exit={{ opacity: 0, scale: 1.01 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
    </AnimatePresence>
  );
}

function TarotBackCard({ alt, className }: { alt: string; className?: string }) {
  return (
    <img
      src={getCardBackPath()}
      data-fallback-src={backAsset.url}
      onError={applyFallback}
      alt={alt}
      className={cn("tarot-card-image", className)}
      loading="lazy"
    />
  );
}

function TarotFrontCard({ cardNumber, alt, className }: { cardNumber: number; alt: string; className?: string }) {
  return (
    <img
      src={getCardFrontPath(cardNumber)}
      data-fallback-src={backAsset.url}
      onError={applyFallback}
      alt={alt}
      className={cn("tarot-card-image", className)}
      loading="lazy"
    />
  );
}

function getPreviewBackground(stage: Stage, spreadId: SpreadId | null, hasDrawnCard: boolean) {
  if (stage === "home") return PREVIEW_BACKGROUNDS.home;
  if (stage === "spreads") return PREVIEW_BACKGROUNDS.spreads;
  if (stage === "shuffle") return PREVIEW_BACKGROUNDS.shuffle;

  const spreadBackgrounds = spreadId ? PREVIEW_BACKGROUNDS[spreadId] : PREVIEW_BACKGROUNDS.daily;

  if (stage === "draw") return hasDrawnCard ? spreadBackgrounds.drawFilled : spreadBackgrounds.draw;
  if (stage === "reveal") return spreadBackgrounds.reveal;
  if (stage === "reading") return spreadBackgrounds.reading;

  return PREVIEW_BACKGROUNDS.home;
}

function applyFallback(event: React.SyntheticEvent<HTMLImageElement>) {
  const target = event.currentTarget;
  const fallback = target.dataset.fallbackSrc;
  if (fallback && target.src !== fallback) {
    target.src = fallback;
  }
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
