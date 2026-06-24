import card1Asset from "@/assets/uploaded/card-1.png.asset.json";
import card2Asset from "@/assets/uploaded/card-2.png.asset.json";
import card3Asset from "@/assets/uploaded/card-3.png.asset.json";
import card4Asset from "@/assets/uploaded/card-4.png.asset.json";
import card5Asset from "@/assets/uploaded/card-5.png.asset.json";
import card6Asset from "@/assets/uploaded/card-6.png.asset.json";
import card7Asset from "@/assets/uploaded/card-7.png.asset.json";
import card8Asset from "@/assets/uploaded/card-8.png.asset.json";
import card9Asset from "@/assets/uploaded/card-9.png.asset.json";
import card10Asset from "@/assets/uploaded/card-10.png.asset.json";
import card11Asset from "@/assets/uploaded/card-11.png.asset.json";
import card12Asset from "@/assets/uploaded/card-12.png.asset.json";
import card13Asset from "@/assets/uploaded/card-13.png.asset.json";
import card14Asset from "@/assets/uploaded/card-14.png.asset.json";
import card15Asset from "@/assets/uploaded/card-15.png.asset.json";
import card16Asset from "@/assets/uploaded/card-16.png.asset.json";
import card17Asset from "@/assets/uploaded/card-17.png.asset.json";
import card18Asset from "@/assets/uploaded/card-18.png.asset.json";
import card19Asset from "@/assets/uploaded/card-19.png.asset.json";
import card20Asset from "@/assets/uploaded/card-20.png.asset.json";
import card21Asset from "@/assets/uploaded/card-21.png.asset.json";
import card22Asset from "@/assets/uploaded/card-22.png.asset.json";
import card23Asset from "@/assets/uploaded/card-23.png.asset.json";
import card24Asset from "@/assets/uploaded/card-24.png.asset.json";
import card25Asset from "@/assets/uploaded/card-25.png.asset.json";
import card26Asset from "@/assets/uploaded/card-26.png.asset.json";
import card27Asset from "@/assets/uploaded/card-27.png.asset.json";
import card28Asset from "@/assets/uploaded/card-28.png.asset.json";
import card29Asset from "@/assets/uploaded/card-29.png.asset.json";
import card30Asset from "@/assets/uploaded/card-30.png.asset.json";
import card31Asset from "@/assets/uploaded/card-31.png.asset.json";
import card32Asset from "@/assets/uploaded/card-32.png.asset.json";
import card33Asset from "@/assets/uploaded/card-33.png.asset.json";
import card34Asset from "@/assets/uploaded/card-34.png.asset.json";
import card35Asset from "@/assets/uploaded/card-35.png.asset.json";
import card36Asset from "@/assets/uploaded/card-36.png.asset.json";
import card37Asset from "@/assets/uploaded/card-37.png.asset.json";
import card38Asset from "@/assets/uploaded/card-38.png.asset.json";
import card39Asset from "@/assets/uploaded/card-39.png.asset.json";
import card40Asset from "@/assets/uploaded/card-40.png.asset.json";
import card41Asset from "@/assets/uploaded/card-41.png.asset.json";
import card42Asset from "@/assets/uploaded/card-42.png.asset.json";
import card43Asset from "@/assets/uploaded/card-43.png.asset.json";
import card44Asset from "@/assets/uploaded/card-44.png.asset.json";
import card45Asset from "@/assets/uploaded/card-45.png.asset.json";
import card46Asset from "@/assets/uploaded/card-46.png.asset.json";
import card47Asset from "@/assets/uploaded/card-47.png.asset.json";
import card48Asset from "@/assets/uploaded/card-48.png.asset.json";
import card49Asset from "@/assets/uploaded/card-49.png.asset.json";
import card50Asset from "@/assets/uploaded/card-50.png.asset.json";
import card51Asset from "@/assets/uploaded/card-51.png.asset.json";
import card52Asset from "@/assets/uploaded/card-52.png.asset.json";
import card53Asset from "@/assets/uploaded/card-53.png.asset.json";
import card54Asset from "@/assets/uploaded/card-54.png.asset.json";
import card55Asset from "@/assets/uploaded/card-55.png.asset.json";
import card56Asset from "@/assets/uploaded/card-56.png.asset.json";
import card57Asset from "@/assets/uploaded/card-57.png.asset.json";
import card58Asset from "@/assets/uploaded/card-58.png.asset.json";
import card59Asset from "@/assets/uploaded/card-59.png.asset.json";
import card60Asset from "@/assets/uploaded/card-60.png.asset.json";
import card61Asset from "@/assets/uploaded/card-61.png.asset.json";
import card62Asset from "@/assets/uploaded/card-62.png.asset.json";
import card63Asset from "@/assets/uploaded/card-63.png.asset.json";
import card64Asset from "@/assets/uploaded/card-64.png.asset.json";
import card65Asset from "@/assets/uploaded/card-65.png.asset.json";
import card66Asset from "@/assets/uploaded/card-66.png.asset.json";
import card67Asset from "@/assets/uploaded/card-67.png.asset.json";
import card68Asset from "@/assets/uploaded/card-68.png.asset.json";
import card69Asset from "@/assets/uploaded/card-69.png.asset.json";
import card70Asset from "@/assets/uploaded/card-70.png.asset.json";
import card71Asset from "@/assets/uploaded/card-71.png.asset.json";
import card72Asset from "@/assets/uploaded/card-72.png.asset.json";
import card73Asset from "@/assets/uploaded/card-73.png.asset.json";
import card74Asset from "@/assets/uploaded/card-74.png.asset.json";
import card75Asset from "@/assets/uploaded/card-75.png.asset.json";
import card76Asset from "@/assets/uploaded/card-76.png.asset.json";
import card77Asset from "@/assets/uploaded/card-77.png.asset.json";
import card78Asset from "@/assets/uploaded/card-78.png.asset.json";

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
    guidance: "对比两条路径，看清各自的走向。",
    revealPrompt: "TAP TO REVEAL",
    interpretationTitle: "两条路径的对照",
    positions: ["现状", "路径 A", "A 的结果", "路径 B", "B 的结果"],
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




const uploadedCardFrontPaths: Partial<Record<number, string>> = {
  1: card1Asset.url,
  2: card2Asset.url,
  3: card3Asset.url,
  4: card4Asset.url,
  5: card5Asset.url,
  6: card6Asset.url,
  7: card7Asset.url,
  8: card8Asset.url,
  9: card9Asset.url,
  10: card10Asset.url,
  11: card11Asset.url,
  12: card12Asset.url,
  13: card13Asset.url,
  14: card14Asset.url,
  15: card15Asset.url,
  16: card16Asset.url,
  17: card17Asset.url,
  18: card18Asset.url,
  19: card19Asset.url,
  20: card20Asset.url,
  21: card21Asset.url,
  22: card22Asset.url,
  23: card23Asset.url,
  24: card24Asset.url,
  25: card25Asset.url,
  26: card26Asset.url,
  27: card27Asset.url,
  28: card28Asset.url,
  29: card29Asset.url,
  30: card30Asset.url,
  31: card31Asset.url,
  32: card32Asset.url,
  33: card33Asset.url,
  34: card34Asset.url,
  35: card35Asset.url,
  36: card36Asset.url,
  37: card37Asset.url,
  38: card38Asset.url,
  39: card39Asset.url,
  40: card40Asset.url,
  41: card41Asset.url,
  42: card42Asset.url,
  43: card43Asset.url,
  44: card44Asset.url,
  45: card45Asset.url,
  46: card46Asset.url,
  47: card47Asset.url,
  48: card48Asset.url,
  49: card49Asset.url,
  50: card50Asset.url,
  51: card51Asset.url,
  52: card52Asset.url,
  53: card53Asset.url,
  54: card54Asset.url,
  55: card55Asset.url,
  56: card56Asset.url,
  57: card57Asset.url,
  58: card58Asset.url,
  59: card59Asset.url,
  60: card60Asset.url,
  61: card61Asset.url,
  62: card62Asset.url,
  63: card63Asset.url,
  64: card64Asset.url,
  65: card65Asset.url,
  66: card66Asset.url,
  67: card67Asset.url,
  68: card68Asset.url,
  69: card69Asset.url,
  70: card70Asset.url,
  71: card71Asset.url,
  72: card72Asset.url,
  73: card73Asset.url,
  74: card74Asset.url,
  75: card75Asset.url,
  76: card76Asset.url,
  77: card77Asset.url,
  78: card78Asset.url,
};

export function getCardBackPath() {
  return "/cat_tarot_78_single_cards/back.png";
}

export function getCardFrontPath(cardNumber: number) {
  return uploadedCardFrontPaths[cardNumber] ?? `/cat_tarot_78_single_cards/${cardNumber}.png`;
}
