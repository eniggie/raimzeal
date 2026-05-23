import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { logger } from "../lib/logger";

const favouriteFoodsRouter = Router();

interface FavRow {
  id: string;
  food_data: Record<string, unknown>;
  sort_order: number;
}

interface FavIdRow {
  id: string;
  food_name: string;
}

favouriteFoodsRouter.get("/user/favourite-foods", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string; // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    const { data, error } = await supabaseAdmin
      .from("favourite_foods")
      .select("id, food_data, sort_order")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    const foods = (data as FavRow[] ?? []).map((r) => ({
      ...r.food_data,
      _serverId: r.id,
    }));
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
    const { data, error } = await supabaseAdmin
      .from("favourite_foods")
      .upsert(
        { user_id: userId, food_name: food.name as string, food_data: food, sort_order: 0 },
        { onConflict: "user_id,food_name" }
      )
      .select("id")
      .single();
    if (error) throw error;
    res.json({ success: true, id: (data as { id: string }).id });
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
    if (foods.length === 0) {
      await supabaseAdmin.from("favourite_foods").delete().eq("user_id", userId);
      res.json({ success: true, foods: [] });
      return;
    }

    const rows = foods.map((food, i) => ({
      user_id: userId,
      food_name: food.name as string,
      food_data: food,
      sort_order: i,
    }));
    // Upsert preserves existing ids (no id change on sort_order update)
    const { error } = await supabaseAdmin
      .from("favourite_foods")
      .upsert(rows, { onConflict: "user_id,food_name" });
    if (error) throw error;

    // Delete orphan rows no longer in the new list
    const { data: existing } = await supabaseAdmin
      .from("favourite_foods")
      .select("id, food_name")
      .eq("user_id", userId);
    const newNames = new Set(foods.map((f) => f.name as string));
    const orphanIds = (existing as FavIdRow[] ?? [])
      .filter((r) => !newNames.has(r.food_name))
      .map((r) => r.id);
    if (orphanIds.length > 0) {
      await supabaseAdmin.from("favourite_foods").delete().in("id", orphanIds);
    }

    // Return updated list with server ids so client can refresh _serverId cache
    const { data: updated } = await supabaseAdmin
      .from("favourite_foods")
      .select("id, food_data")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true });
    const updatedFoods = (updated as { id: string; food_data: Record<string, unknown> }[] ?? []).map((r) => ({
      ...r.food_data,
      _serverId: r.id,
    }));
    res.json({ success: true, foods: updatedFoods });
  } catch (err) {
    logger.error({ err }, "PUT /user/favourite-foods/reorder error");
    res.status(500).json({ error: "Could not reorder favourite foods." });
  }
});

favouriteFoodsRouter.delete("/user/favourite-foods/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string; // eslint-disable-line @typescript-eslint/no-explicit-any
  const id = req.params["id"] as string;
  try {
    const { error } = await supabaseAdmin
      .from("favourite_foods")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "DELETE /user/favourite-foods/:id error");
    res.status(500).json({ error: "Could not remove favourite food." });
  }
});

export default favouriteFoodsRouter;
