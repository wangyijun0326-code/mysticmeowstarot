import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const ReadingInput = z.object({
  spread: z.string().min(1),
  cards: z
    .array(
      z.object({
        position: z.string().min(1),
        name: z.string().min(1),
        state: z.enum(["正位", "逆位"]),
      }),
    )
    .min(1)
    .max(5),
});

const ReadingOutput = z.object({
  summary: z.string(),
  perCard: z.array(
    z.object({
      position: z.string(),
      title: z.string(),
      text: z.string(),
    }),
  ),
});

function extractJson(raw: string): unknown {
  let cleaned = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("No JSON object found in AI response");
  }
  cleaned = cleaned.substring(start, end + 1);
  try {
    return JSON.parse(cleaned);
  } catch {
    cleaned = cleaned.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
    return JSON.parse(cleaned);
  }
}

export const generateTarotReading = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ReadingInput.parse(input))
  .handler(async ({ data }) => {
    const lovableApiKey = process.env.LOVABLE_API_KEY;
    if (!lovableApiKey) {
      throw new Error("Missing LOVABLE_API_KEY");
    }

    const gateway = createLovableAiGatewayProvider(lovableApiKey);
    const cardsPrompt = data.cards
      .map((card, index) => `${index + 1}. 位置：${card.position}｜牌名：${card.name}｜状态：${card.state}`)
      .join("\n");

    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system:
        "你是一位中立、克制且富有洞察力的塔罗解读者。你只依据牌阵中每张牌所在位置的客观逻辑关系与牌面正逆位来解读，绝不预设任何具体生活领域（不要假设爱情、事业、学业、健康、财运等任何主题），也绝不向用户提问或编造背景场景。\n\n牌位逻辑（务必严格遵守）：\n- 牌位 1：现状——描述当前的处境与能量基调。\n- 牌位 2、3：路径 A 及其结果——牌位 2 是选择路径 A 时的走向，牌位 3 是该路径的最终结果。\n- 牌位 4、5：路径 B 及其结果——牌位 4 是选择路径 B 时的走向，牌位 5 是该路径的最终结果。\n（若牌数少于 5，则按收到的位置标签如实解读，不要套用以上结构。）\n\n请基于这些牌的逻辑关系，生成一段平衡、对比清晰的解读：客观呈现两条路径各自的特征与可能结果，让用户自行权衡，不做倾向性劝导，不下绝对结论。语言优雅、平实、中性。输出必须为中文。\n\n只输出一个 JSON 对象，不要包含任何 JSON 以外的文本或 markdown 代码块。JSON 结构如下：{\"summary\": string, \"perCard\": [{\"position\": string, \"title\": string, \"text\": string}]}。其中 summary 写成 140 到 260 字、对两条路径做平衡对照的整体解读；perCard 的元素数量与卡牌一致，每张牌 text 写 28 到 80 字、紧扣其位置含义的客观提示，title 用“牌名｜正位/逆位”的形式，position 必须与输入的位置完全一致。",
      prompt: `牌阵：${data.spread}\n卡牌（按牌位顺序）：\n${cardsPrompt}`,
    });


    return ReadingOutput.parse(extractJson(text));
  });
