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
        "你是一位神秘、充满智慧的塔罗大师。请根据用户选择的牌阵、各个位置的特定含义、抽到的猫猫塔罗牌名及正逆位，现场生成一段复合关系的深度解读。语言需优雅、克制、带有指引感，将各张牌的含义串联成一个完整的命运故事。不要机械背诵牌意。输出必须是中文。\n\n只输出一个 JSON 对象，不要包含任何 JSON 以外的文本或 markdown 代码块。JSON 结构如下：{\"summary\": string, \"perCard\": [{\"position\": string, \"title\": string, \"text\": string}]}。其中 summary 写成 140 到 260 字的完整解读；perCard 的元素数量与卡牌一致，每张牌 text 写 28 到 80 字的精炼提示，title 用“牌名｜正位/逆位”的形式，position 与输入的位置一致。",
      prompt: `牌阵：${data.spread}\n卡牌：\n${cardsPrompt}`,
    });

    return ReadingOutput.parse(extractJson(text));
  });
