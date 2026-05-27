import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp } from "drizzle-orm/pg-core";

export const digestSubscribers = pgTable("digest_subscribers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  userName: text("user_name").notNull(),
  userId: varchar("user_id"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export type DigestSubscriber = typeof digestSubscribers.$inferSelect;
export type NewDigestSubscriber = typeof digestSubscribers.$inferInsert;
