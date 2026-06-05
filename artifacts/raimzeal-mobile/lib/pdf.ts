import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import type { AppState } from "@/contexts/FitnessContext";
import type { MacroGoals } from "@/contexts/MacroGoalsContext";

export type DateRangeOption = "7d" | "30d" | "90d" | "all";

function getDateRangeLabel(option: DateRangeOption): string {
  switch (option) {
    case "7d": return "Last 7 Days";
    case "30d": return "Last 30 Days";
    case "90d": return "Last 90 Days";
    case "all": return "All Time";
  }
}

function getCutoffDate(option: DateRangeOption): Date | null {
  if (option === "all") return null;
  const days = option === "7d" ? 7 : option === "30d" ? 30 : 90;
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - days + 1);
  return cutoff;
}

export async function exportToPdf(state: AppState, macroGoals?: MacroGoals, dateRange: DateRangeOption = "all"): Promise<void> {
  const { user, streak, personalRecords, settings } = state;

  const cutoff = getCutoffDate(dateRange);
  const filterByDate = <T extends { date: string }>(items: T[]): T[] => {
    if (!cutoff) return items;
    return items.filter((item) => new Date(item.date) >= cutoff);
  };

  const workoutLogs = filterByDate(state.workoutLogs);
  const mealLogs = filterByDate(state.mealLogs);
  const bodyMeasurements = filterByDate(state.bodyMeasurements);

  const generatedAt = new Date().toLocaleString();
  const dateRangeLabel = getDateRangeLabel(dateRange);
  const totalCalBurned = workoutLogs.reduce((s, l) => s + l.caloriesBurned, 0);
  const totalMinutes = workoutLogs.reduce((s, l) => s + l.duration, 0);
  const uniqueDays = [...new Set(mealLogs.map((m) => m.date))].length;
  const avgCal =
    uniqueDays > 0
      ? Math.round(mealLogs.reduce((s, m) => s + m.calories, 0) / uniqueDays)
      : 0;
  const avgProtein =
    uniqueDays > 0
      ? Math.round(mealLogs.reduce((s, m) => s + m.protein, 0) / uniqueDays)
      : 0;
  const avgCarbs =
    uniqueDays > 0
      ? Math.round(mealLogs.reduce((s, m) => s + m.carbs, 0) / uniqueDays)
      : 0;
  const avgFat =
    uniqueDays > 0
      ? Math.round(mealLogs.reduce((s, m) => s + m.fat, 0) / uniqueDays)
      : 0;
  const latestWeight = bodyMeasurements[bodyMeasurements.length - 1]?.weight ?? user?.weight ?? 0;
  const unit = settings.weightUnit;

  const workoutRows = workoutLogs
    .map(
      (log) => `
        <tr>
          <td>${new Date(log.date).toLocaleDateString()}</td>
          <td>${log.workoutName}</td>
          <td>${log.duration} min</td>
          <td>${log.caloriesBurned} kcal</td>
          <td>${log.exercises.map((e) => `${e.name} ${e.sets}×${e.reps}${e.weight ? ` @${e.weight}${unit}` : ""}`).join(", ")}</td>
        </tr>`
    )
    .join("");

  const mealRows = mealLogs
    .slice(0, 60)
    .map(
      (m) => `
        <tr>
          <td>${new Date(m.date).toLocaleDateString()}</td>
          <td>${m.name}</td>
          <td style="text-transform:capitalize">${m.mealType}</td>
          <td>${m.calories}</td>
          <td>${m.protein}g</td>
          <td>${m.carbs}g</td>
          <td>${m.fat}g</td>
        </tr>`
    )
    .join("");

  const measurementRows = bodyMeasurements
    .map(
      (m) => `
        <tr>
          <td>${new Date(m.date).toLocaleDateString()}</td>
          <td>${m.weight} ${unit}</td>
          <td>${m.chest ?? "—"}</td>
          <td>${m.waist ?? "—"}</td>
          <td>${m.hips ?? "—"}</td>
        </tr>`
    )
    .join("");

  const prRows = personalRecords
    .map(
      (pr) => `
        <tr>
          <td>${pr.exercise}</td>
          <td>${pr.weight} ${unit}</td>
          <td>${new Date(pr.date).toLocaleDateString()}</td>
        </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>RAIMZEAL Fitness Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; background: #fff; padding: 40px; }
    /* Header */
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 3px solid #82cb15; }
    .brand { display: flex; align-items: center; gap: 14px; }
    .brand-logo { width: 52px; height: 52px; border-radius: 13px; display: block; object-fit: cover; }
    .brand-logo-fallback { width: 52px; height: 52px; background: #82cb15; border-radius: 13px; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 900; color: #0a0a0b; flex-shrink: 0; }
    .brand-name { font-size: 28px; font-weight: 900; color: #0a0a0b; letter-spacing: -0.5px; }
    .brand-sub { font-size: 12px; color: #6b7280; margin-top: 2px; }
    .report-meta { text-align: right; }
    .report-meta .title { font-size: 16px; font-weight: 600; color: #0a0a0b; }
    .report-meta .date { font-size: 12px; color: #6b7280; margin-top: 4px; }
    /* Summary cards */
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
    .stat-card { background: linear-gradient(135deg, #f0fdf0, #fff); border: 1px solid #d1fae5; border-radius: 12px; padding: 16px; text-align: center; }
    .stat-card .val { font-size: 28px; font-weight: 800; color: #82cb15; }
    .stat-card .lbl { font-size: 11px; color: #6b7280; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    /* Profile */
    .section { margin-bottom: 32px; }
    .section-title { font-size: 16px; font-weight: 700; color: #0a0a0b; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 2px solid #82cb15; display: flex; align-items: center; gap: 8px; }
    .profile-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .profile-item { background: #f9fafb; border-radius: 8px; padding: 10px 12px; }
    .profile-item .label { font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.4px; }
    .profile-item .value { font-size: 14px; font-weight: 600; color: #1a1a1a; margin-top: 2px; }
    /* Tables */
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    thead tr { background: #0a0a0b; color: #fff; }
    thead th { padding: 9px 10px; text-align: left; font-weight: 600; font-size: 11px; letter-spacing: 0.3px; }
    tbody tr:nth-child(even) { background: #f9fafb; }
    tbody td { padding: 8px 10px; border-bottom: 1px solid #f0f0f0; }
    /* Nutrition Goals */
    .goals-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .goal-card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 12px; text-align: center; background: #f9fafb; }
    .goal-card .macro-name { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; margin-bottom: 10px; }
    .goal-card .goal-val { font-size: 20px; font-weight: 800; color: #82cb15; }
    .goal-card .goal-unit { font-size: 10px; color: #9ca3af; margin-bottom: 8px; }
    .goal-card .avg-row { display: flex; align-items: center; justify-content: center; gap: 4px; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #e5e7eb; }
    .goal-card .avg-label { font-size: 10px; color: #9ca3af; }
    .goal-card .avg-val { font-size: 12px; font-weight: 700; }
    .avg-under { color: #3b82f6; }
    .avg-over { color: #ef4444; }
    .avg-on { color: #82cb15; }
    .no-data-note { font-size: 11px; color: #9ca3af; font-style: italic; margin-top: 8px; }
    /* Badges */
    .badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 600; text-transform: capitalize; }
    .badge-breakfast { background: #fef3c7; color: #92400e; }
    .badge-lunch { background: #e0f2fe; color: #0369a1; }
    .badge-dinner { background: #ede9fe; color: #5b21b6; }
    .badge-snack { background: #dcfce7; color: #14532d; }
    /* Footer */
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 10px; color: #9ca3af; }
    .notice { background: #fffbeb; border-left: 3px solid #f59e0b; padding: 10px 14px; border-radius: 0 6px 6px 0; font-size: 11px; color: #92400e; margin-top: 16px; }
    .empty { font-size: 13px; color: #9ca3af; font-style: italic; padding: 12px 0; }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <div class="brand">
      <img
        class="brand-logo"
        src="https://raimzeal.com/favicon.png"
        alt="RAIMZEAL"
        onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
      />
      <div class="brand-logo-fallback" style="display:none;">R</div>
      <div>
        <div class="brand-name">RAIMZEAL</div>
        <div class="brand-sub">AI-Powered Fitness Platform</div>
      </div>
    </div>
    <div class="report-meta">
      <div class="title">Health &amp; Fitness Report</div>
      <div class="date">Period: ${dateRangeLabel}</div>
      <div class="date">Generated: ${generatedAt}</div>
    </div>
  </div>

  <!-- Summary Stats -->
  <div class="summary-grid">
    <div class="stat-card"><div class="val">${workoutLogs.length}</div><div class="lbl">Total Workouts</div></div>
    <div class="stat-card"><div class="val">${totalCalBurned.toLocaleString()}</div><div class="lbl">Calories Burned</div></div>
    <div class="stat-card"><div class="val">${totalMinutes}</div><div class="lbl">Minutes Trained</div></div>
    <div class="stat-card"><div class="val">${avgCal}</div><div class="lbl">Avg Daily Calories</div></div>
  </div>

  <!-- Member Profile -->
  <div class="section">
    <div class="section-title">👤 Member Profile</div>
    <div class="profile-grid">
      <div class="profile-item"><div class="label">Full Name</div><div class="value">${user?.name ?? "—"}</div></div>
      <div class="profile-item"><div class="label">Email</div><div class="value">${user?.email ?? "—"}</div></div>
      <div class="profile-item"><div class="label">Age</div><div class="value">${user?.age ?? "—"} years</div></div>
      <div class="profile-item"><div class="label">Height</div><div class="value">${user?.height ?? "—"} ${user?.units === "metric" ? "cm" : "in"}</div></div>
      <div class="profile-item"><div class="label">Current Weight</div><div class="value">${latestWeight.toFixed(1)} ${unit}</div></div>
      <div class="profile-item"><div class="label">Fitness Level</div><div class="value" style="text-transform:capitalize">${user?.fitnessLevel ?? "—"}</div></div>
      <div class="profile-item"><div class="label">Goals</div><div class="value">${user?.goals?.map((g) => g.replace("_", " ")).join(", ") ?? "—"}</div></div>
      <div class="profile-item"><div class="label">Current Streak</div><div class="value">${streak} days 🔥</div></div>
      <div class="profile-item"><div class="label">Member Since</div><div class="value">${user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}</div></div>
    </div>
  </div>

  <!-- Nutrition Goals -->
  ${macroGoals ? `
  <div class="section">
    <div class="section-title">🎯 Nutrition Goals</div>
    <div class="goals-grid">
      ${(
        [
          { key: "calories", label: "Calories", goal: macroGoals.calories, avg: uniqueDays > 0 ? avgCal : null, unit: "kcal" },
          { key: "protein", label: "Protein", goal: macroGoals.protein, avg: uniqueDays > 0 ? avgProtein : null, unit: "g" },
          { key: "carbs", label: "Carbs", goal: macroGoals.carbs, avg: uniqueDays > 0 ? avgCarbs : null, unit: "g" },
          { key: "fat", label: "Fat", goal: macroGoals.fat, avg: uniqueDays > 0 ? avgFat : null, unit: "g" },
        ] as const
      )
        .map(({ label, goal, avg, unit: u }) => {
          const diff = avg !== null ? avg - goal : null;
          const pct = avg !== null && goal > 0 ? Math.round((avg / goal) * 100) : null;
          const cls = diff === null ? "" : Math.abs(diff) <= goal * 0.05 ? "avg-on" : diff < 0 ? "avg-under" : "avg-over";
          const arrow = diff === null ? "" : Math.abs(diff) <= goal * 0.05 ? "✓" : diff < 0 ? "▼" : "▲";
          const avgBlock = avg !== null
            ? `<div class="avg-row"><span class="avg-label">Avg</span><span class="avg-val ${cls}">${arrow} ${avg} ${u} (${pct}%)</span></div>`
            : `<div class="avg-row"><span class="no-data-note">No data yet</span></div>`;
          return `<div class="goal-card">
            <div class="macro-name">${label}</div>
            <div class="goal-val">${goal}</div>
            <div class="goal-unit">Goal · ${u}/day</div>
            ${avgBlock}
          </div>`;
        })
        .join("")}
    </div>
  </div>` : ""}

  <!-- Workout History -->
  <div class="section">
    <div class="section-title">🏋️ Workout History</div>
    ${workoutLogs.length > 0 ? `
    <table>
      <thead><tr><th>Date</th><th>Workout</th><th>Duration</th><th>Calories</th><th>Exercises</th></tr></thead>
      <tbody>${workoutRows}</tbody>
    </table>` : '<p class="empty">No workouts logged yet.</p>'}
  </div>

  <!-- Personal Records -->
  <div class="section">
    <div class="section-title">🏆 Personal Records</div>
    ${personalRecords.length > 0 ? `
    <table>
      <thead><tr><th>Exercise</th><th>Weight</th><th>Date Achieved</th></tr></thead>
      <tbody>${prRows}</tbody>
    </table>` : '<p class="empty">No personal records yet.</p>'}
  </div>

  <!-- Body Measurements -->
  <div class="section">
    <div class="section-title">📏 Body Measurements</div>
    ${bodyMeasurements.length > 0 ? `
    <table>
      <thead><tr><th>Date</th><th>Weight</th><th>Chest</th><th>Waist</th><th>Hips</th></tr></thead>
      <tbody>${measurementRows}</tbody>
    </table>` : '<p class="empty">No measurements logged yet.</p>'}
  </div>

  <!-- Nutrition Log -->
  <div class="section">
    <div class="section-title">🥗 Nutrition Log (last 60 entries)</div>
    ${mealLogs.length > 0 ? `
    <table>
      <thead><tr><th>Date</th><th>Food</th><th>Meal</th><th>Calories</th><th>Protein</th><th>Carbs</th><th>Fat</th></tr></thead>
      <tbody>${mealRows}</tbody>
    </table>` : '<p class="empty">No meals logged yet.</p>'}
  </div>

  <div class="notice">
    ⚠️ This report is based on data you have personally logged in RAIMZEAL. For medical or clinical decisions, always consult a qualified healthcare professional.
  </div>

  <div class="footer">
    <span>RAIMZEAL — AI-Powered Fitness Platform</span>
    <span>Generated ${generatedAt} · Confidential</span>
  </div>
</body>
</html>`;

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: "Share your RAIMZEAL Fitness Report",
      UTI: "com.adobe.pdf",
    });
  }
}
