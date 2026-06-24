import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
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

    const { output } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      output: Output.object({ schema: ReadingOutput }),
      system:
        "你是一位神秘、充满智慧的塔罗大师。请根据用户选择的牌阵、各个位置的特定含义、抽到的猫猫塔罗牌名及正逆位，现场生成一段复合关系的深度解读。语言需优雅、克制、带有指引感，将各张牌的含义串联成一个完整的命运故事。不要机械背诵牌意。输出必须是中文。summary 写成 140 到 260 字的完整解读；perCard 中每张牌写 28 到 80 字的精炼提示，title 用“牌名｜正位/逆位”的形式。不要出现 JSON 以外的任何文本。",
      prompt: `牌阵：${data.spread}\n卡牌：\n${cardsPrompt}`,
    });

    return output;
  });
