import { sql } from "drizzle-orm";
import { boolean, integer, json, jsonb, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const programs = pgTable("programs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  level: varchar("level", { enum: ["beginner", "intermediate", "advanced"] }).notNull(),
  durationWeeks: integer("duration_weeks").notNull(),
  goals: text("goals").array(),
  schedule: json("schedule"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertProgramSchema = createInsertSchema(programs).omit({
  id: true,
  createdAt: true,
});
export type InsertProgram = z.infer<typeof insertProgramSchema>;
export type Program = typeof programs.$inferSelect;

export const enrolledPrograms = pgTable(
  "enrolled_programs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull(),
    programId: varchar("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    programName: text("program_name").notNull(),
    programData: jsonb("program_data").notNull(),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    currentWeek: integer("current_week").notNull().default(1),
    currentDay: integer("current_day").notNull().default(1),
    completedAt: timestamp("completed_at"),
    /** Last YYYY-MM-DD date a workout was logged against this enrollment. Used to prevent double-advancing on the same calendar day. */
    lastAdvanceDate: varchar("last_advance_date", { length: 10 }),
  },
  (table) => [
    uniqueIndex("enrolled_programs_user_program_idx").on(table.userId, table.programId),
  ]
);

export type EnrolledProgramRow = typeof enrolledPrograms.$inferSelect;
