import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { logger } from "../lib/logger";

const favouriteFoodsRouter = Router();

interface FavRow {
  food_data: Record<string, unknown>;
  sort_order: number;
}

favouriteFoodsRouter.get("/user/favourite-foods", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string; // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    const { data, error } = await supabaseAdmin
      .from("favourite_foods")
      .select("food_data, sort_order")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    const foods = (data as FavRow[] ?? []).map((r) => r.food_data);
    res.json({ foods });
  } catch (err) {
    logger.error({ err }, "GET /user/favourite-foods error");
    res.status(500).json({ error: "Could not fetch favourite foods." });
  }
});

favouriteFoodsRouter.post("/user/favourite-foods", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string; // eslint-disable-line @typescript-eslint/no-explicit-any
  const { food } = req.body as { food: Record<string, unknown> };
  if (!food || typeof food.name !== "string") {
    res.status(400).json({ error: "food with a name field is required." });
    return;
  }
  try {
    const { error } = await supabaseAdmin
      .from("favourite_foods")
      .upsert(
        { user_id: userId, food_name: food.name as string, food_data: food, sort_order: 0 },
        { onConflict: "user_id,food_name" }
      );
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "POST /user/favourite-foods error");
    res.status(500).json({ error: "Could not save favourite food." });
  }
});

favouriteFoodsRouter.put("/user/favourite-foods/reorder", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string; // eslint-disable-line @typescript-eslint/no-explicit-any
  const { foods } = req.body as { foods: Record<string, unknown>[] };
  if (!Array.isArray(foods)) {
    res.status(400).json({ error: "foods array is required." });
    return;
  }
  try {
    await supabaseAdmin.from("favourite_foods").delete().eq("user_id", userId);
    if (foods.length > 0) {
      const rows = foods.map((food, i) => ({
        user_id: userId,
        food_name: food.name as string,
        food_data: food,
        sort_order: i,
      }));
      const { error } = await supabaseAdmin.from("favourite_foods").insert(rows);
      if (error) throw error;
    }
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "PUT /user/favourite-foods/reorder error");
    res.status(500).json({ error: "Could not reorder favourite foods." });
  }
});

favouriteFoodsRouter.delete("/user/favourite-foods/:foodName", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string; // eslint-disable-line @typescript-eslint/no-explicit-any
  const foodName = decodeURIComponent(req.params["foodName"] as string);
  try {
    const { error } = await supabaseAdmin
      .from("favourite_foods")
      .delete()
      .eq("user_id", userId)
      .eq("food_name", foodName);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "DELETE /user/favourite-foods/:foodName error");
    res.status(500).json({ error: "Could not remove favourite food." });
  }
});

export default favouriteFoodsRouter;
