import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger";

const mealPhotoRouter = Router();

const AnalyzeSchema = z.object({
  imageBase64: z.string().min(10),
  mimeType: z.enum(["image/jpeg", "image/jpg", "image/png", "image/webp"]),
});

mealPhotoRouter.post("/user/meal-photo/analyze", requireAuth, async (req, res) => {
  const parse = AnalyzeSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "imageBase64 and mimeType required." });
    return;
  }
  const { imageBase64, mimeType } = parse.data;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 512,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
                detail: "low",
              },
            },
            {
              type: "text",
              text: `Analyze this food photo and estimate the nutritional content for the visible portion.
Respond ONLY with valid JSON in this exact format (no markdown, no explanation):
{"name":"dish name","calories":number,"protein_g":number,"carbs_g":number,"fat_g":number,"confidence":"low|medium|high","notes":"optional brief note"}

Rules:
- Be conservative on calories if portion is unclear
- protein_g, carbs_g, fat_g should be whole numbers
- confidence: "high" if food is clearly identifiable, "medium" if plausible, "low" if very unclear
- If this is not a food image, return: {"error":"Not a food image"}`,
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      logger.warn({ content }, "Non-JSON response from vision model");
      res.status(422).json({ error: "Could not parse nutritional data from image." });
      return;
    }
    const p = parsed as Record<string, unknown>;
    if (p["error"]) {
      res.status(422).json({ error: String(p["error"]) });
      return;
    }
    res.json({
      name: String(p["name"] ?? "Unknown dish"),
      calories: Number(p["calories"] ?? 0),
      protein_g: Number(p["protein_g"] ?? 0),
      carbs_g: Number(p["carbs_g"] ?? 0),
      fat_g: Number(p["fat_g"] ?? 0),
      confidence: String(p["confidence"] ?? "low"),
      notes: p["notes"] ? String(p["notes"]) : null,
    });
  } catch (err) {
    logger.error({ err }, "POST /user/meal-photo/analyze error");
    res.status(500).json({ error: "Could not analyze image." });
  }
});

export default mealPhotoRouter;
