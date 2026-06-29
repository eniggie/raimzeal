/**
 * Daily wellness tips — a curated, rotating library shown on the Home screen.
 *
 * One tip surfaces per day (deterministic by day-of-year, so it's stable for the
 * whole day and advances automatically at midnight). No backend / AI dependency,
 * so it always works even when Ovia's server is down.
 */

import type { Ionicons } from "@expo/vector-icons";

export type TipCategory =
  | "fitness"
  | "nutrition"
  | "hydration"
  | "sleep"
  | "mindset"
  | "recovery"
  | "womens";

export interface DailyTip {
  category: TipCategory;
  text: string;
}

export const CATEGORY_META: Record<
  TipCategory,
  { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  fitness: { label: "Training", icon: "barbell-outline", color: "#1AE07E" },
  nutrition: { label: "Nutrition", icon: "nutrition-outline", color: "#F5C542" },
  hydration: { label: "Hydration", icon: "water-outline", color: "#38BDF8" },
  sleep: { label: "Sleep", icon: "moon-outline", color: "#A78BFA" },
  mindset: { label: "Mindset", icon: "sparkles-outline", color: "#F472B6" },
  recovery: { label: "Recovery", icon: "bed-outline", color: "#34D399" },
  womens: { label: "Women's Health", icon: "female-outline", color: "#FB7185" },
};

export const DAILY_TIPS: DailyTip[] = [
  // Fitness / training
  { category: "fitness", text: "Progressive overload beats novelty. Add a little weight, a rep, or a set before changing the whole routine." },
  { category: "fitness", text: "Warm up the movement you're about to do — a few light sets primes your nervous system and protects your joints." },
  { category: "fitness", text: "Two to three full-body sessions a week build more strength for most people than scattered single-muscle days." },
  { category: "fitness", text: "Tempo matters: a slow 3-second lowering phase creates more muscle tension than rushing the weight down." },
  { category: "fitness", text: "Consistency over intensity. A 20-minute workout you actually do beats the perfect hour you skip." },
  { category: "fitness", text: "Track your lifts. What gets measured gets improved — your future self will thank you for the log." },
  { category: "fitness", text: "Rest 1–2 minutes between strength sets so your next set is strong, not just survived." },
  { category: "fitness", text: "Walking counts. 7–8k steps a day quietly burns calories and protects your heart with zero soreness." },

  // Nutrition
  { category: "nutrition", text: "Protein at every meal keeps you full and protects muscle — aim for a palm-sized portion each time." },
  { category: "nutrition", text: "Eat the rainbow. Different coloured plants give you different antioxidants and fibre your gut loves." },
  { category: "nutrition", text: "You don't have to eat perfectly — aim for 80% whole foods and let the other 20% be life." },
  { category: "nutrition", text: "Fibre is a free appetite controller. Beans, oats, fruit and veg keep you fuller for longer." },
  { category: "nutrition", text: "Read the serving size, not just the calories — the number on the front is often for half the pack." },
  { category: "nutrition", text: "Pre-log a big meal before you eat it. Seeing the numbers first makes mindful choices easier." },
  { category: "nutrition", text: "Slow down. It takes ~20 minutes for your brain to register fullness — put the fork down between bites." },

  // Hydration
  { category: "hydration", text: "Start the day with a glass of water — you wake up mildly dehydrated after a night's sleep." },
  { category: "hydration", text: "Thirst is often mistaken for hunger. Try water first when a craving hits between meals." },
  { category: "hydration", text: "A good rule of thumb: aim for clear-to-pale-yellow urine, not bright yellow." },
  { category: "hydration", text: "Keep a bottle within arm's reach. Visibility is the simplest hydration hack there is." },

  // Sleep
  { category: "sleep", text: "Sleep is when muscle repairs and fat-loss hormones reset. It's a training tool, not a luxury." },
  { category: "sleep", text: "Dim the screens an hour before bed — blue light delays the melatonin that makes you sleepy." },
  { category: "sleep", text: "A cool, dark room (around 18°C) helps you fall asleep faster and stay asleep longer." },
  { category: "sleep", text: "Same wake-up time every day — even weekends — is the strongest anchor for good sleep." },
  { category: "sleep", text: "Caffeine has a ~6-hour half-life. That 4pm coffee is still half-awake in your system at 10pm." },

  // Mindset
  { category: "mindset", text: "You don't need motivation, you need a small starting ritual. Put on your shoes — the rest follows." },
  { category: "mindset", text: "Missed a day? Don't make it two. One off day is a blip; the streak is your direction, not your prison." },
  { category: "mindset", text: "Compare yourself to who you were last month, not to anyone on your feed." },
  { category: "mindset", text: "Habits beat goals. The goal gets you started; the system keeps you going." },
  { category: "mindset", text: "Celebrate showing up. The wins you acknowledge are the behaviours you repeat." },

  // Recovery
  { category: "recovery", text: "Soreness isn't a scoreboard. Recovery — not just effort — is where the results are actually built." },
  { category: "recovery", text: "A rest day is part of the plan, not a failure of it. Muscles grow while you recover." },
  { category: "recovery", text: "Gentle movement on rest days (a walk, light stretching) eases soreness better than total stillness." },
  { category: "recovery", text: "If a joint hurts (not a muscle), back off. Pain is information, not weakness." },

  // Women's health
  { category: "womens", text: "Energy naturally dips before your period — scale intensity to how you feel, not to a fixed plan." },
  { category: "womens", text: "Iron needs rise around menstruation. Leafy greens, beans and lean red meat help top you up." },
  { category: "womens", text: "Strength training supports bone density — especially valuable through perimenopause and beyond." },
  { category: "womens", text: "Track your cycle alongside your training: many people feel strongest in the week after their period." },
];

/** Days since Jan 1 of the current year (0–365). */
function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / 86_400_000);
}

/** Returns the tip for a given date (defaults to today). Stable for the whole day. */
export function getTodaysTip(date: Date = new Date()): DailyTip {
  const index = dayOfYear(date) % DAILY_TIPS.length;
  return DAILY_TIPS[index];
}
