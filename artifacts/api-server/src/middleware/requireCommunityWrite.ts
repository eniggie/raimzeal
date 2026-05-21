import { type Request, type Response, type NextFunction } from "express";
import { getUserTier, canAccess } from "../lib/tier";

/**
 * requireCommunityWrite — 403 if the authenticated user is on the Foundation (free) tier.
 * Foundation members may read posts and toggle likes but cannot create posts,
 * add comments, or submit replies. Must be used AFTER requireAuth so that
 * (req as any).userId is guaranteed to be set.
 */
export async function requireCommunityWrite(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = (req as any).userId as string | undefined;
  if (!userId) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  const tier = await getUserTier(userId);

  if (!canAccess(tier, "rise")) {
    res.status(403).json({
      error:
        "Creating posts, comments, and replies requires a Rise, Reign, or Legacy membership. Foundation members can view and like posts.",
      code: "COMMUNITY_WRITE_GATED",
    });
    return;
  }

  next();
}
