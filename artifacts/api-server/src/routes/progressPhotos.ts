import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { logger } from "../lib/logger";
import { getUserTier } from "../lib/tier";

const progressPhotosRouter = Router();

async function ensureBucket() {
  try {
    const { error } = await supabaseAdmin.storage.createBucket("progress-photos", {
      public: false,
      fileSizeLimit: 10485760,
      allowedMimeTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
    });
    if (error && !error.message.includes("already exists")) {
      logger.warn({ err: error }, "Could not create progress-photos bucket");
    }
  } catch { /* already exists */ }
}

ensureBucket();

progressPhotosRouter.get("/user/progress-photos", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  try {
    const { data, error } = await supabaseAdmin
      .from("progress_photos")
      .select("id, storage_path, caption, weight_kg, body_fat_pct, taken_at, created_at")
      .eq("user_id", userId)
      .order("taken_at", { ascending: false });
    if (error) throw error;
    const photos = await Promise.all(
      (data ?? []).map(async (p: { id: string; storage_path: string; caption: string | null; weight_kg: number | null; body_fat_pct: number | null; taken_at: string; created_at: string }) => {
        const { data: url } = await supabaseAdmin.storage
          .from("progress-photos")
          .createSignedUrl(p.storage_path, 3600);
        return { ...p, url: url?.signedUrl ?? null };
      })
    );
    res.json({ photos });
  } catch (err) {
    logger.error({ err }, "GET /user/progress-photos error");
    res.status(500).json({ error: "Could not fetch progress photos." });
  }
});

progressPhotosRouter.post("/user/progress-photos/upload-url", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const tier = await getUserTier(userId);
  if (tier === "foundation") {
    res.status(403).json({ error: "Progress photo uploads are available on Rise, Reign, and Legacy plans.", code: "UPGRADE_REQUIRED" });
    return;
  }
  const { filename, contentType } = req.body as { filename: string; contentType: string };
  if (!filename || !contentType) { res.status(400).json({ error: "filename and contentType required." }); return; }
  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (!allowed.includes(contentType)) { res.status(400).json({ error: "Invalid image type." }); return; }
  const ext = contentType.split("/")[1] || "jpg";
  const storagePath = `${userId}/${Date.now()}.${ext}`;
  try {
    const { data, error } = await supabaseAdmin.storage
      .from("progress-photos")
      .createSignedUploadUrl(storagePath);
    if (error) throw error;
    res.json({ uploadUrl: data.signedUrl, storagePath, token: data.token });
  } catch (err) {
    logger.error({ err }, "POST /user/progress-photos/upload-url error");
    res.status(500).json({ error: "Could not generate upload URL." });
  }
});

progressPhotosRouter.post("/user/progress-photos", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const { storage_path, caption, weight_kg, body_fat_pct, taken_at } = req.body as {
    storage_path: string; caption?: string; weight_kg?: number; body_fat_pct?: number; taken_at?: string;
  };
  if (!storage_path) { res.status(400).json({ error: "storage_path required." }); return; }
  if (!storage_path.startsWith(`${userId}/`)) { res.status(403).json({ error: "Forbidden." }); return; }
  try {
    const { data, error } = await supabaseAdmin
      .from("progress_photos")
      .insert({ user_id: userId, storage_path, caption: caption ?? null, weight_kg: weight_kg ?? null, body_fat_pct: body_fat_pct ?? null, taken_at: taken_at ?? new Date().toISOString().split("T")[0] })
      .select()
      .single();
    if (error) throw error;
    res.json({ photo: data });
  } catch (err) {
    logger.error({ err }, "POST /user/progress-photos error");
    res.status(500).json({ error: "Could not save progress photo." });
  }
});

progressPhotosRouter.delete("/user/progress-photos/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const id = req.params["id"] as string;
  try {
    const { data } = await supabaseAdmin
      .from("progress_photos")
      .select("storage_path")
      .eq("id", id)
      .eq("user_id", userId)
      .single();
    if (!data) { res.status(404).json({ error: "Not found." }); return; }
    const row = data as { storage_path: string };
    await supabaseAdmin.storage.from("progress-photos").remove([row.storage_path]);
    await supabaseAdmin.from("progress_photos").delete().eq("id", id).eq("user_id", userId);
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "DELETE /user/progress-photos/:id error");
    res.status(500).json({ error: "Could not delete photo." });
  }
});

export default progressPhotosRouter;
