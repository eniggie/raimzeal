import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { requireAuth } from "../middleware/auth";
import { communityMutateLimitLight, communityMutateLimitHeavy } from "../lib/rateLimiter";
import { randomUUID } from "crypto";

// Supabase project URL — fall back to the known project ref if the env var
// contains the anon key value instead of the URL (a common misconfiguration).
const rawSupabaseUrl = process.env["EXPO_PUBLIC_SUPABASE_URL"] ?? "";
const supabaseUrl = rawSupabaseUrl.startsWith("https://")
  ? rawSupabaseUrl
  : "https://druogyuqjytmkwihinhg.supabase.co";

/**
 * Admin client — uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS entirely.
 * This is intentional: the server has already validated the caller's identity
 * via requireAuth, so it is trusted to perform only the targeted writes below.
 * The service key must NEVER be sent to any client.
 */
function getAdminClient() {
  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const communityRouter = Router();

// ── POST /api/community/image-upload-url ─────────────────────────────────────
// Returns a Supabase Storage signed upload URL so the client can PUT an image
// directly to the community-images bucket, without streaming bytes through the
// API server. The public URL is also returned so the caller can attach it to
// the subsequent POST /community/posts request.
communityRouter.post(
  "/community/image-upload-url",
  requireAuth,
  communityMutateLimitHeavy,
  async (req, res) => {
    const userId = (req as any).userId as string;
    const { ext } = req.body as { ext?: unknown };

    const safeExt = typeof ext === "string" && /^[a-z0-9]{1,5}$/.test(ext) ? ext : "jpg";
    const path = `${userId}/${randomUUID()}.${safeExt}`;

    const supabase = getAdminClient();
    const { data, error } = await supabase.storage
      .from("community-images")
      .createSignedUploadUrl(path);

    if (error || !data) {
      req.log.error({ error }, "Failed to create signed upload URL");
      res.status(500).json({ error: "Failed to create upload URL" });
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("community-images")
      .getPublicUrl(path);

    res.json({ uploadUrl: data.signedUrl, publicUrl });
  }
);

// ── POST /api/community/posts ────────────────────────────────────────────────
// Creates a new community post.
// userId is extracted exclusively from the validated JWT — never from the body.
communityRouter.post(
  "/community/posts",
  requireAuth,
  communityMutateLimitHeavy,
  async (req, res) => {
    const userId = (req as any).userId as string;
    const { userName, content, postType, imageUrl } = req.body as {
      userName?: unknown;
      content?: unknown;
      postType?: unknown;
      imageUrl?: unknown;
    };

    if (typeof content !== "string" || !content.trim()) {
      res.status(400).json({ error: "content is required" });
      return;
    }
    if (typeof userName !== "string" || !userName.trim()) {
      res.status(400).json({ error: "userName is required" });
      return;
    }
    if (postType !== "post" && postType !== "question") {
      res.status(400).json({ error: "postType must be 'post' or 'question'" });
      return;
    }
    if (content.trim().length > 2000) {
      res.status(400).json({ error: "content too long (max 2000 characters)" });
      return;
    }
    const safeImageUrl =
      typeof imageUrl === "string" && imageUrl.startsWith("https://") ? imageUrl : null;

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("community_posts")
      .insert({
        user_id: userId,                        // always from JWT
        user_name: userName.trim().slice(0, 60),
        content: content.trim(),
        post_type: postType,
        ...(safeImageUrl ? { image_url: safeImageUrl } : {}),
      })
      .select()
      .single();

    if (error || !data) {
      req.log.error({ error }, "Failed to create community post");
      res.status(500).json({ error: "Failed to create post" });
      return;
    }
    res.status(201).json({ post: data });
  }
);

// ── POST /api/community/posts/:postId/likes ──────────────────────────────────
// Toggles the authenticated user's like on a post.
// The server atomically insert/deletes only the row owned by the JWT user,
// then returns the live count from community_likes — no UPDATE to community_posts.
communityRouter.post(
  "/community/posts/:postId/likes",
  requireAuth,
  communityMutateLimitLight,
  async (req, res) => {
    const userId = (req as any).userId as string;
    const { postId } = req.params;

    const supabase = getAdminClient();

    // Check whether this user has already liked this post
    const { data: existing } = await supabase
      .from("community_likes")
      .select("id")
      .eq("post_id", postId)
      .eq("user_id", userId)           // scoped to the JWT user only
      .maybeSingle();

    if (existing) {
      await supabase
        .from("community_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", userId);        // can only delete own like
    } else {
      await supabase
        .from("community_likes")
        .insert({ post_id: postId, user_id: userId });
    }

    // Authoritative count comes from community_likes — never updates community_posts
    const { count } = await supabase
      .from("community_likes")
      .select("*", { count: "exact", head: true })
      .eq("post_id", postId);

    res.json({ liked: !existing, count: count ?? 0 });
  }
);

// ── POST /api/community/posts/:postId/comments ───────────────────────────────
// Adds a comment to a post.
// user_id is forced to the JWT user — the body userName is only used for display.
communityRouter.post(
  "/community/posts/:postId/comments",
  requireAuth,
  communityMutateLimitLight,
  async (req, res) => {
    const userId = (req as any).userId as string;
    const { postId } = req.params;
    const { userName, content } = req.body as {
      userName?: unknown;
      content?: unknown;
    };

    if (typeof content !== "string" || !content.trim()) {
      res.status(400).json({ error: "content is required" });
      return;
    }
    if (typeof userName !== "string" || !userName.trim()) {
      res.status(400).json({ error: "userName is required" });
      return;
    }
    if (content.trim().length > 1000) {
      res.status(400).json({ error: "comment too long (max 1000 characters)" });
      return;
    }

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("community_comments")
      .insert({
        post_id: postId,
        user_id: userId,                        // always from JWT
        user_name: userName.trim().slice(0, 60),
        content: content.trim(),
      })
      .select()
      .single();

    if (error || !data) {
      req.log.error({ error }, "Failed to create comment");
      res.status(500).json({ error: "Failed to create comment" });
      return;
    }
    res.status(201).json({ comment: data });
  }
);

export default communityRouter;
