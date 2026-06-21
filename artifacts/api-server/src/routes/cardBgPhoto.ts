import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { logger } from "../lib/logger";
import { generalWriteRateLimit } from "../lib/rateLimiter";

const cardBgPhotoRouter = Router();

const BUCKET = "card-bg-photos";

async function ensureBucket() {
  try {
    const { error } = await supabaseAdmin.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: 10485760,
      allowedMimeTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
    });
    if (error && !error.message.includes("already exists")) {
      logger.warn({ err: error }, "Could not create card-bg-photos bucket");
    }
  } catch { /* already exists */ }
}

ensureBucket();

const UploadUrlBodySchema = z.object({
  filename: z.string().min(1).max(200),
  contentType: z.enum(["image/jpeg", "image/jpg", "image/png", "image/webp"]),
});

cardBgPhotoRouter.post(
  "/user/card-bg-photo/upload-url",
  requireAuth,
  generalWriteRateLimit,
  async (req, res) => {
    const userId = (req as any).userId as string; // eslint-disable-line @typescript-eslint/no-explicit-any
    const parse = UploadUrlBodySchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.errors[0]?.message ?? "Invalid request." });
      return;
    }
    const { contentType } = parse.data;
    const ext = contentType.split("/")[1] || "jpg";
    const storagePath = `${userId}/card_bg_${Date.now()}.${ext}`;
    try {
      const { data, error } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUploadUrl(storagePath);
      if (error) throw error;
      res.json({ uploadUrl: data.signedUrl, storagePath });
    } catch (err) {
      logger.error({ err }, "POST /user/card-bg-photo/upload-url error");
      res.status(500).json({ error: "Could not generate upload URL." });
    }
  }
);

const DownloadUrlQuerySchema = z.object({
  path: z.string().min(1),
});

cardBgPhotoRouter.get(
  "/user/card-bg-photo/download-url",
  requireAuth,
  async (req, res) => {
    const userId = (req as any).userId as string; // eslint-disable-line @typescript-eslint/no-explicit-any
    const parse = DownloadUrlQuerySchema.safeParse(req.query);
    if (!parse.success) {
      res.status(400).json({ error: "path query param required." });
      return;
    }
    const { path } = parse.data;
    if (!path.startsWith(`${userId}/`)) {
      res.status(403).json({ error: "Forbidden." });
      return;
    }
    try {
      const { data, error } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(path, 604800);
      if (error) throw error;
      res.json({ downloadUrl: data.signedUrl });
    } catch (err) {
      logger.error({ err }, "GET /user/card-bg-photo/download-url error");
      res.status(500).json({ error: "Could not generate download URL." });
    }
  }
);

export default cardBgPhotoRouter;
