import { sql } from "drizzle-orm";
import { integer, jsonb, pgTable, text, timestamp, unique, varchar } from "drizzle-orm/pg-core";

export const favouriteFoods = pgTable(
  "favourite_foods",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull(),
    foodName: text("food_name").notNull(),
    foodData: jsonb("food_data").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [unique("uniq_fav_food_per_user").on(table.userId, table.foodName)]
);

export type FavouriteFoodRow = typeof favouriteFoods.$inferSelect;
