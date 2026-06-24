import card1Asset from "@/assets/uploaded/card-1.png.asset.json";
import card2Asset from "@/assets/uploaded/card-2.png.asset.json";
import card3Asset from "@/assets/uploaded/card-3.png.asset.json";

export type SpreadId = "daily" | "three" | "either";
export type CardState = "正位" | "逆位";


export interface TarotCardMeta {
  number: number;
  name: string;
}

export interface DrawnCard extends TarotCardMeta {
  state: CardState;
  position: string;
  slotIndex: number;
}

export interface SpreadDefinition {
  id: SpreadId;
  title: string;
  subtitle: string;
  guidance: string;
  revealPrompt: string;
  interpretationTitle: string;
  positions: string[];
}

export const SPREADS: Record<SpreadId, SpreadDefinition> = {
  daily: {
    id: "daily",
    title: "DAILY DRAW",
    subtitle: "日运指引",
    guidance: "ONE CARD, ONE MESSAGE. START YOUR DAY.",
    revealPrompt: "TAP TO REVEAL",
    interpretationTitle: "今日灵讯",
    positions: ["DAILY MESSAGE"],
  },
  three: {
    id: "three",
    title: "THREE CARDS",
    subtitle: "过去 / 现在 / 未来",
    guidance: "PAST, PRESENT, FUTURE. CLARITY IN THREE.",
    revealPrompt: "TAP TO REVEAL",
    interpretationTitle: "时间的线索",
    positions: ["PAST", "PRESENT", "FUTURE"],
  },
  either: {
    id: "either",
    title: "EITHER OR",
    subtitle: "二选一牌阵",
    guidance: "COMPARE TWO PATHS. CHOOSE YOUR DIRECTION.",
    revealPrompt: "TAP TO REVEAL",
    interpretationTitle: "命运分岔口",
    positions: ["CURRENT", "A PATH", "A OUTCOME", "B PATH", "B OUTCOME"],
  },
};

export const SLOT_LAYOUTS: Record<SpreadId, Array<{ left: string; top: string }>> = {
  daily: [{ left: "50%", top: "47%" }],
  three: [
    { left: "25%", top: "50%" },
    { left: "50%", top: "50%" },
    { left: "75%", top: "50%" },
  ],
  either: [
    { left: "50%", top: "72%" },
    { left: "34%", top: "48%" },
    { left: "22%", top: "25%" },
    { left: "66%", top: "48%" },
    { left: "78%", top: "25%" },
  ],
};

export const tarotDeck: TarotCardMeta[] = [
  { number: 1, name: "愚者" },
  { number: 2, name: "魔术师" },
  { number: 3, name: "女祭司" },
  { number: 4, name: "皇后" },
  { number: 5, name: "皇帝" },
  { number: 6, name: "教皇" },
  { number: 7, name: "恋人" },
  { number: 8, name: "战车" },
  { number: 9, name: "力量" },
  { number: 10, name: "隐者" },
  { number: 11, name: "命运之轮" },
  { number: 12, name: "正义" },
  { number: 13, name: "倒吊人" },
  { number: 14, name: "死神" },
  { number: 15, name: "节制" },
  { number: 16, name: "恶魔" },
  { number: 17, name: "高塔" },
  { number: 18, name: "星星" },
  { number: 19, name: "月亮" },
  { number: 20, name: "太阳" },
  { number: 21, name: "审判" },
  { number: 22, name: "世界" },
  { number: 23, name: "权杖首牌" },
  { number: 24, name: "权杖二" },
  { number: 25, name: "权杖三" },
  { number: 26, name: "权杖四" },
  { number: 27, name: "权杖五" },
  { number: 28, name: "权杖六" },
  { number: 29, name: "权杖七" },
  { number: 30, name: "权杖八" },
  { number: 31, name: "权杖九" },
  { number: 32, name: "权杖十" },
  { number: 33, name: "权杖侍从" },
  { number: 34, name: "权杖骑士" },
  { number: 35, name: "权杖王后" },
  { number: 36, name: "权杖国王" },
  { number: 37, name: "圣杯首牌" },
  { number: 38, name: "圣杯二" },
  { number: 39, name: "圣杯三" },
  { number: 40, name: "圣杯四" },
  { number: 41, name: "圣杯五" },
  { number: 42, name: "圣杯六" },
  { number: 43, name: "圣杯七" },
  { number: 44, name: "圣杯八" },
  { number: 45, name: "圣杯九" },
  { number: 46, name: "圣杯十" },
  { number: 47, name: "圣杯侍从" },
  { number: 48, name: "圣杯骑士" },
  { number: 49, name: "圣杯王后" },
  { number: 50, name: "圣杯国王" },
  { number: 51, name: "宝剑首牌" },
  { number: 52, name: "宝剑二" },
  { number: 53, name: "宝剑三" },
  { number: 54, name: "宝剑四" },
  { number: 55, name: "宝剑五" },
  { number: 56, name: "宝剑六" },
  { number: 57, name: "宝剑七" },
  { number: 58, name: "宝剑八" },
  { number: 59, name: "宝剑九" },
  { number: 60, name: "宝剑十" },
  { number: 61, name: "宝剑侍从" },
  { number: 62, name: "宝剑骑士" },
  { number: 63, name: "宝剑王后" },
  { number: 64, name: "宝剑国王" },
  { number: 65, name: "星币首牌" },
  { number: 66, name: "星币二" },
  { number: 67, name: "星币三" },
  { number: 68, name: "星币四" },
  { number: 69, name: "星币五" },
  { number: 70, name: "星币六" },
  { number: 71, name: "星币七" },
  { number: 72, name: "星币八" },
  { number: 73, name: "星币九" },
  { number: 74, name: "星币十" },
  { number: 75, name: "星币侍从" },
  { number: 76, name: "星币骑士" },
  { number: 77, name: "星币王后" },
  { number: 78, name: "星币国王" },
];

export function shuffleDeck<T>(cards: T[]) {
  const next = [...cards];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

export function createSessionDeck() {
  return shuffleDeck(tarotDeck).map((card, index) => ({
    ...card,
    instanceId: `${card.number}-${index}`,
    state: Math.random() > 0.5 ? ("正位" as const) : ("逆位" as const),
  }));
}

export function getStageReferencePath(stage: "home" | "spreads" | "shuffle" | "draw" | "reveal", spreadId?: SpreadId | null) {
  if (stage === "home") return "/WEB UI DESIGN1/menu.png";
  if (stage === "spreads") return "/WEB UI DESIGN1/spreads (2).png";
  if (stage === "shuffle") return "/WEB UI DESIGN1/wash.png";

  if (spreadId === "daily") {
    return stage === "draw"
      ? "/WEB UI DESIGN1/one card.png"
      : "/WEB UI DESIGN1/one card reversal.png";
  }

  if (spreadId === "three") {
    return stage === "draw"
      ? "/WEB UI DESIGN2/three cards.png"
      : "/WEB UI DESIGN2/three cards reversal.png";
  }

  return stage === "draw"
    ? "/WEB UI DESIGN2/five cards.png"
    : "/WEB UI DESIGN2/five cards reversal.png";
}

const uploadedCardFrontPaths: Partial<Record<number, string>> = {
  1: card1Asset.url,
  2: card2Asset.url,
  3: card3Asset.url,
};

export function getCardBackPath() {
  return "/cat_tarot_78_single_cards/back.png";
}

export function getCardFrontPath(cardNumber: number) {
  return uploadedCardFrontPaths[cardNumber] ?? `/cat_tarot_78_single_cards/${cardNumber}.png`;
}
