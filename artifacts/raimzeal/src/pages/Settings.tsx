import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'wouter';
import {
  ChevronRight, Moon, Type, Bell,
  LogOut, Scale, Edit2, Check, X, Heart, ExternalLink, Download,
  Target, Trophy, Globe, Trash2, Camera
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BottomNav } from '@/components/BottomNav';
import { cn } from '@/lib/utils';
import type { AppState, UserProfile } from '@/lib/store';

import { STRIPE_DONATION_URL, DONATION_ACTIVE, RAIMZY_LINKTREE } from '@/lib/constants';

interface SettingsProps {
  state: AppState;
  onUpdateSettings: (settings: Partial<AppState['settings']>) => void;
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
  onLogout: () => void;
}

export function Settings({ state, onUpdateSettings, onUpdateProfile, onLogout }: SettingsProps) {
  const user = state.user;
  const [settingsDonationError, setSettingsDonationError] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  function handleExportData() {
    if (exportLoading) return;
    setExportLoading(true);
    try {
      const u = state.user;
      const wUnit = state.settings.weightUnit ?? 'lbs';
      const exportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const exportDateShort = new Date().toISOString().slice(0, 10);

      const totalCalBurned = state.workoutLogs.reduce((s, w) => s + (w.caloriesBurned ?? 0), 0);
      const totalMinutes = state.workoutLogs.reduce((s, w) => s + (w.duration ?? 0), 0);
      const avgDailyCal = state.mealLogs.length
        ? Math.round(state.mealLogs.reduce((s, m) => s + (m.calories ?? 0), 0) / Math.max(1, new Set(state.mealLogs.map(m => m.date)).size))
        : 0;

      const statCard = (val: string | number, label: string, icon: string) =>
        `<div class="stat-card"><div class="stat-icon">${icon}</div><div class="stat-val">${val}</div><div class="stat-lbl">${label}</div></div>`;

      const profileField = (label: string, value: string | number | undefined) =>
        `<div class="pf-item"><div class="pf-label">${label}</div><div class="pf-value">${value ?? '—'}</div></div>`;

      const workoutTableRows = state.workoutLogs.slice(0, 200).map(w =>
        `<tr><td>${w.date ?? ''}</td><td class="fw600">${w.workoutName ?? ''}</td><td>${w.duration ? w.duration + ' min' : '—'}</td><td>${w.caloriesBurned ? w.caloriesBurned + ' kcal' : '—'}</td></tr>`
      ).join('');

      const mealTableRows = state.mealLogs.slice(0, 200).map(m =>
        `<tr><td>${m.date ?? ''}</td><td class="fw600">${m.name ?? ''}</td><td>${m.mealType ?? ''}</td><td class="num">${m.calories ?? 0}</td><td class="num green">${m.protein ?? 0}g</td><td class="num orange">${m.carbs ?? 0}g</td><td class="num blue">${m.fat ?? 0}g</td></tr>`
      ).join('');

      const bodyTableRows = state.bodyMeasurements.slice(0, 200).map(b =>
        `<tr><td>${b.date ?? ''}</td><td class="fw600">${b.weight ?? '—'} ${wUnit}</td><td>${b.chest ?? '—'}</td><td>${b.waist ?? '—'}</td><td>${b.hips ?? '—'}</td></tr>`
      ).join('');

      const prTableRows = state.personalRecords.slice(0, 200).map(pr =>
        `<tr><td class="fw600">${pr.exercise ?? ''}</td><td class="num">${pr.weight ?? '—'} ${wUnit}</td><td>${pr.date ?? ''}</td></tr>`
      ).join('');

      const waterTableRows = state.waterIntake.slice(0, 200).map(w =>
        `<tr><td>${w.date ?? ''}</td><td class="num">${w.glasses ?? 0} glasses</td><td class="num">${Math.round((w.glasses ?? 0) * 240)} ml</td></tr>`
      ).join('');

      const bloodGroup = u?.bloodType ? `${u.bloodType}${u.rhFactor ?? ''}` : null;
      const healthProfileHtml = (bloodGroup || u?.genotype) ? `
<div class="section-header"><span class="section-icon">🧬</span> Health Profile</div>
<div class="health-grid">
  ${bloodGroup ? `<div class="health-card"><div class="health-val">${bloodGroup}</div><div class="health-lbl">Blood Group</div></div>` : ''}
  ${u?.genotype ? `<div class="health-card ${u.genotype === 'SS' || u.genotype === 'SC' ? 'health-card-alert' : ''}"><div class="health-val">${u.genotype}</div><div class="health-lbl">Genotype</div></div>` : ''}
</div>` : '';

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>RAIMZEAL Health &amp; Fitness Report — ${u?.name ?? 'User'}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f0f4f0;color:#1a1a1a;min-height:100vh}

  /* ── HEADER ── */
  .report-header{background:linear-gradient(135deg,#1a2e1a 0%,#2E8B57 100%);color:#fff;padding:40px 48px 36px;position:relative;overflow:hidden}
  .report-header::after{content:'';position:absolute;right:-60px;top:-60px;width:280px;height:280px;border-radius:50%;background:rgba(255,255,255,.05)}
  .logo-row{display:flex;align-items:center;gap:14px;margin-bottom:20px}
  .logo-mark{width:48px;height:48px;background:#fff;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .logo-mark svg{width:32px;height:32px}
  .logo-text{font-size:1.6rem;font-weight:800;letter-spacing:-.5px;color:#fff}
  .logo-sub{font-size:.75rem;color:rgba(255,255,255,.7);letter-spacing:1px;text-transform:uppercase;margin-top:1px}
  .header-meta{display:flex;gap:32px;margin-top:8px;flex-wrap:wrap}
  .header-meta-item{display:flex;flex-direction:column;gap:2px}
  .header-meta-label{font-size:.7rem;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:.5px}
  .header-meta-value{font-size:.95rem;font-weight:600;color:#fff}
  .report-title{font-size:2rem;font-weight:800;margin-bottom:6px;line-height:1.1}
  .report-subtitle{font-size:.9rem;color:rgba(255,255,255,.75);margin-bottom:24px}

  /* ── BODY ── */
  .page-body{max-width:920px;margin:0 auto;padding:32px 32px 48px}

  /* ── MISSION BANNER ── */
  .mission-banner{background:#fff;border:1px solid #d1fae5;border-left:4px solid #2E8B57;border-radius:12px;padding:18px 22px;margin-bottom:28px;display:flex;gap:16px;align-items:flex-start}
  .mission-icon{font-size:1.5rem;flex-shrink:0;margin-top:2px}
  .mission-title{font-size:.85rem;font-weight:700;color:#166534;margin-bottom:4px}
  .mission-text{font-size:.8rem;color:#4b5563;line-height:1.5}

  /* ── STATS ROW ── */
  .stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:28px}
  .stat-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:18px 14px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.05)}
  .stat-icon{font-size:1.4rem;margin-bottom:6px}
  .stat-val{font-size:1.6rem;font-weight:800;color:#2E8B57;line-height:1}
  .stat-lbl{font-size:.7rem;color:#6b7280;margin-top:5px;text-transform:uppercase;letter-spacing:.5px}

  /* ── SECTION ── */
  .section{background:#fff;border:1px solid #e5e7eb;border-radius:14px;margin-bottom:22px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.05)}
  .section-header{display:flex;align-items:center;gap:10px;padding:16px 22px;font-size:.9rem;font-weight:700;color:#1a1a1a;background:#f9faf9;border-bottom:1px solid #e5e7eb}
  .section-icon{font-size:1.1rem}

  /* ── PROFILE FIELDS ── */
  .pf-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:0;padding:0}
  .pf-item{padding:14px 22px;border-bottom:1px solid #f3f4f6;border-right:1px solid #f3f4f6}
  .pf-item:nth-child(3n){border-right:none}
  .pf-label{font-size:.7rem;text-transform:uppercase;letter-spacing:.5px;color:#9ca3af;margin-bottom:4px}
  .pf-value{font-size:.95rem;font-weight:600;color:#1a1a1a}

  /* ── HEALTH PROFILE ── */
  .health-grid{display:flex;gap:14px;padding:18px 22px;flex-wrap:wrap}
  .health-card{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 22px;text-align:center;min-width:100px}
  .health-card-alert{background:#fef2f2;border-color:#fecaca}
  .health-val{font-size:1.6rem;font-weight:800;color:#166534}
  .health-card-alert .health-val{color:#dc2626}
  .health-lbl{font-size:.7rem;color:#6b7280;margin-top:4px;text-transform:uppercase;letter-spacing:.5px}

  /* ── TABLES ── */
  table{width:100%;border-collapse:collapse;font-size:.82rem}
  thead tr{background:#f9faf9}
  th{padding:10px 22px;text-align:left;font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;border-bottom:1px solid #e5e7eb}
  td{padding:10px 22px;border-bottom:1px solid #f3f4f6;color:#374151}
  tr:last-child td{border-bottom:none}
  tr:hover td{background:#fafafa}
  .fw600{font-weight:600;color:#1a1a1a}
  .num{font-variant-numeric:tabular-nums;text-align:right}
  .green{color:#16a34a;font-weight:600}
  .orange{color:#d97706;font-weight:600}
  .blue{color:#2563eb;font-weight:600}
  .empty-row td{text-align:center;color:#9ca3af;padding:28px;font-style:italic}

  /* ── DONATION CTA ── */
  .donation-section{background:linear-gradient(135deg,#1a2e1a,#166534);border-radius:14px;padding:32px;margin-bottom:22px;color:#fff;text-align:center}
  .donation-heart{font-size:2.5rem;margin-bottom:12px}
  .donation-title{font-size:1.2rem;font-weight:800;margin-bottom:8px}
  .donation-text{font-size:.85rem;color:rgba(255,255,255,.8);line-height:1.6;max-width:540px;margin:0 auto 20px}
  .donation-btn{display:inline-block;background:#fff;color:#166534;font-size:.9rem;font-weight:700;padding:12px 36px;border-radius:50px;text-decoration:none;letter-spacing:.2px}
  .donation-url{font-size:.75rem;color:rgba(255,255,255,.5);margin-top:10px}

  /* ── FOOTER ── */
  .report-footer{text-align:center;font-size:.75rem;color:#9ca3af;padding:24px 0 0;border-top:1px solid #e5e7eb;line-height:1.8}
  .report-footer a{color:#2E8B57;text-decoration:none}
  .disclaimer{background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 20px;margin-bottom:28px;font-size:.78rem;color:#92400e;line-height:1.5}
  .disclaimer strong{font-weight:700}

  @media print{
    body{background:#fff}
    .page-body{padding:16px}
    .donation-section{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .report-header{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  }
</style>
</head>
<body>

<!-- ══ HEADER ══ -->
<div class="report-header">
  <div class="logo-row">
    <div class="logo-mark">
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" rx="8" fill="#2E8B57"/>
        <path d="M8 8h8a6 6 0 0 1 0 12h-4l5 8H13l-5-8V8zm4 4v4h4a2 2 0 0 0 0-4h-4z" fill="#fff"/>
      </svg>
    </div>
    <div>
      <div class="logo-text">RAIMZEAL</div>
      <div class="logo-sub">AI-Powered Fitness &amp; Health Platform</div>
    </div>
  </div>
  <div class="report-title">Health &amp; Fitness Report</div>
  <div class="report-subtitle">Personal health data export · All data is private and belongs to you</div>
  <div class="header-meta">
    <div class="header-meta-item"><div class="header-meta-label">Member</div><div class="header-meta-value">${u?.name ?? 'User'}</div></div>
    <div class="header-meta-item"><div class="header-meta-label">Email</div><div class="header-meta-value">${u?.email ?? '—'}</div></div>
    <div class="header-meta-item"><div class="header-meta-label">Generated</div><div class="header-meta-value">${exportDate}</div></div>
    <div class="header-meta-item"><div class="header-meta-label">Member Since</div><div class="header-meta-value">${u?.createdAt ? new Date(u.createdAt).toLocaleDateString('en-US',{year:'numeric',month:'short'}) : '—'}</div></div>
  </div>
</div>

<div class="page-body">

<!-- ══ MISSION BANNER ══ -->
<div class="mission-banner">
  <div class="mission-icon">🌱</div>
  <div>
    <div class="mission-title">RAIMZEAL — Free, Non-Profit Fitness, Food Therapy &amp; Healthcare Awareness Platform</div>
    <div class="mission-text">RAIMZEAL has no membership fees, no paid tiers, and no hidden charges — ever. Every feature is 100% free. We are operated by ECONTEUR LLC as a non-profit community health initiative. RAIMZEAL is <strong>not here to replace any doctor, healthcare professional, or medical facility</strong> — we exist to complement their work and help spread health awareness to more people. We are sustained entirely by voluntary donations. No donation is ever required.</div>
  </div>
</div>

<!-- ══ STATS ══ -->
<div class="stats-row">
  ${statCard(state.workoutLogs.length, 'Total Workouts', '🏋️')}
  ${statCard(totalCalBurned.toLocaleString(), 'Calories Burned', '🔥')}
  ${statCard(totalMinutes.toLocaleString(), 'Minutes Trained', '⏱️')}
  ${statCard(avgDailyCal.toLocaleString(), 'Avg Daily Calories', '🥗')}
</div>

<!-- ══ PROFILE ══ -->
<div class="section">
  <div class="section-header"><span class="section-icon">👤</span> Member Profile</div>
  <div class="pf-grid">
    ${profileField('Full Name', u?.name)}
    ${profileField('Email', u?.email)}
    ${profileField('Age', u?.age ? u.age + ' years' : undefined)}
    ${profileField('Height', u?.height ? u.height + ' cm' : undefined)}
    ${profileField('Current Weight', u?.weight ? u.weight + ' ' + wUnit : undefined)}
    ${profileField('Fitness Level', u?.fitnessLevel ? u.fitnessLevel.charAt(0).toUpperCase() + u.fitnessLevel.slice(1) : undefined)}
    ${profileField('Goals', u?.goals?.join(', ') || undefined)}
    ${profileField('Current Streak', state.streak + ' days')}
    ${profileField('Units', u?.units ?? '—')}
  </div>
</div>

${healthProfileHtml ? `<div class="section">${healthProfileHtml}</div>` : ''}

<!-- ══ WORKOUT HISTORY ══ -->
<div class="section">
  <div class="section-header"><span class="section-icon">🏋️</span> Workout History</div>
  ${state.workoutLogs.length ? `<table>
    <thead><tr><th>Date</th><th>Workout</th><th>Duration</th><th style="text-align:right">Calories</th></tr></thead>
    <tbody>${workoutTableRows}</tbody>
  </table>` : '<table><tbody><tr class="empty-row"><td colspan="4">No workouts logged yet — start your first session!</td></tr></tbody></table>'}
</div>

<!-- ══ PERSONAL RECORDS ══ -->
<div class="section">
  <div class="section-header"><span class="section-icon">🏆</span> Personal Records</div>
  ${state.personalRecords.length ? `<table>
    <thead><tr><th>Exercise</th><th style="text-align:right">Best Weight</th><th>Date Achieved</th></tr></thead>
    <tbody>${prTableRows}</tbody>
  </table>` : '<table><tbody><tr class="empty-row"><td colspan="3">No personal records yet.</td></tr></tbody></table>'}
</div>

<!-- ══ BODY MEASUREMENTS ══ -->
<div class="section">
  <div class="section-header"><span class="section-icon">📏</span> Body Measurements</div>
  ${state.bodyMeasurements.length ? `<table>
    <thead><tr><th>Date</th><th>Weight</th><th>Chest</th><th>Waist</th><th>Hips</th></tr></thead>
    <tbody>${bodyTableRows}</tbody>
  </table>` : '<table><tbody><tr class="empty-row"><td colspan="5">No measurements logged yet.</td></tr></tbody></table>'}
</div>

<!-- ══ NUTRITION LOG ══ -->
<div class="section">
  <div class="section-header"><span class="section-icon">🥗</span> Nutrition Log <span style="font-weight:400;color:#9ca3af;font-size:.8rem;margin-left:6px">(last 200 entries)</span></div>
  ${state.mealLogs.length ? `<table>
    <thead><tr><th>Date</th><th>Food</th><th>Meal</th><th style="text-align:right">Calories</th><th style="text-align:right">Protein</th><th style="text-align:right">Carbs</th><th style="text-align:right">Fat</th></tr></thead>
    <tbody>${mealTableRows}</tbody>
  </table>` : '<table><tbody><tr class="empty-row"><td colspan="7">No meals logged yet.</td></tr></tbody></table>'}
</div>

<!-- ══ WATER INTAKE ══ -->
<div class="section">
  <div class="section-header"><span class="section-icon">💧</span> Water Intake</div>
  ${state.waterIntake.length ? `<table>
    <thead><tr><th>Date</th><th style="text-align:right">Glasses</th><th style="text-align:right">Volume (ml)</th></tr></thead>
    <tbody>${waterTableRows}</tbody>
  </table>` : '<table><tbody><tr class="empty-row"><td colspan="3">No water intake logged yet.</td></tr></tbody></table>'}
</div>

<!-- ══ DISCLAIMER ══ -->
<div class="disclaimer">
  <strong>Important disclaimer:</strong> This report is based on data you have personally logged in RAIMZEAL. It is provided for personal reference only and does not constitute medical advice, diagnosis, or treatment of any kind. RAIMZEAL does not replace any doctor, physician, registered dietitian, or healthcare facility — we are here to complement and support qualified healthcare providers. Always consult a licensed healthcare professional before making any changes to your diet, exercise routine, or health management. <strong>You are fully and solely responsible for any action or decision you make based on information from this application.</strong> RAIMZEAL and ECONTEUR LLC accept no liability for any injury, illness, or adverse outcome arising from your use of this platform.
</div>

<!-- ══ DONATION CTA ══ -->
<div class="donation-section">
  <div class="donation-heart">💚</div>
  <div class="donation-title">We turned down deals. RAIMZEAL is free forever.</div>
  <div class="donation-text">
    We turned down deals to keep it that way. No membership fees, no subscriptions, no ads — your health was never up for sale. Please support the team. A donation supports the team keeping this alive for everyone who needs it.<br/><br/>
    Books · Music · Courses · Coaching · Resources at <a href="https://linktr.ee/Raimzy" target="_blank" rel="noopener noreferrer" style="color:#2E8B57;font-weight:600">linktr.ee/Raimzy</a>
  </div>
  <a class="donation-btn" href="https://donate.stripe.com/aFa6oH7GE50z37Xdmh6kg00" target="_blank" rel="noopener noreferrer">
    💚 &nbsp;Donate — Support the Team
  </a>
  <div class="donation-url">donate.stripe.com · Secure · No account required · Any amount helps</div>
</div>

<!-- ══ FOOTER ══ -->
<div class="report-footer">
  <strong>RAIMZEAL</strong> — AI-Powered Fitness &amp; Health Platform · Free Forever<br/>
  Created and powered by <a href="https://www.econteur.com" target="_blank" rel="noopener noreferrer">ECONTEUR LLC</a> · www.econteur.com · <a href="mailto:support@raimzeal.com">support@raimzeal.com</a><br/>
  Generated ${exportDate} · This document is confidential and belongs to ${u?.name ?? 'the account holder'}
</div>

</div><!-- /page-body -->
</body>
</html>`;

      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `raimzeal-report-${exportDateShort}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportLoading(false);
    }
  }
  const [editingProfile, setEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState({
    name: user?.name || '',
    age: user?.age?.toString() || '',
    height: user?.height?.toString() || '',
    weight: user?.weight?.toString() || '',
    fitnessLevel: user?.fitnessLevel || 'beginner',
    bloodType: user?.bloodType || '' as UserProfile['bloodType'] | '',
    rhFactor: user?.rhFactor || '' as UserProfile['rhFactor'] | '',
    genotype: user?.genotype || '' as UserProfile['genotype'] | '',
  });

  const handleSaveProfile = () => {
    onUpdateProfile({
      name: editForm.name,
      age: parseInt(editForm.age) || user?.age || 0,
      height: parseInt(editForm.height) || user?.height || 0,
      weight: parseFloat(editForm.weight) || user?.weight || 0,
      fitnessLevel: editForm.fitnessLevel as UserProfile['fitnessLevel'],
      bloodType: (editForm.bloodType || undefined) as UserProfile['bloodType'],
      rhFactor: (editForm.rhFactor || undefined) as UserProfile['rhFactor'],
      genotype: (editForm.genotype || undefined) as UserProfile['genotype'],
    });
    setEditingProfile(false);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-4 pt-6 pb-4 space-y-6 max-w-lg mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold font-display">Profile</h1>
        </motion.div>

        {/* Profile Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-4" data-testid="card-profile">
            {!editingProfile ? (
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16">
                  <AvatarFallback className="text-xl bg-primary/20 text-primary">
                    {user?.name?.split(' ').map(n => n[0]).join('') || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h2 className="text-xl font-bold truncate max-w-[200px]" data-testid="text-name">{user?.name || 'User'}</h2>
                  <p className="text-muted-foreground text-sm truncate max-w-[200px]" data-testid="text-email">{user?.email}</p>
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                    {user?.age && <span>{user.age} yrs</span>}
                    {user?.fitnessLevel && <><span>·</span><span className="capitalize">{user.fitnessLevel}</span></>}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditForm({
                      name: user?.name || '',
                      age: user?.age?.toString() || '',
                      height: user?.height?.toString() || '',
                      weight: user?.weight?.toString() || '',
                      fitnessLevel: user?.fitnessLevel || 'beginner',
                      bloodType: user?.bloodType || '',
                      rhFactor: user?.rhFactor || '',
                      genotype: user?.genotype || '',
                    });
                    setEditingProfile(true);
                  }}
                  data-testid="button-edit-profile"
                >
                  <Edit2 className="w-3 h-3 mr-1" />
                  Edit
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Edit Profile</h3>
                  <Button variant="ghost" size="icon" onClick={() => setEditingProfile(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="edit-name">Full Name</Label>
                    <Input
                      id="edit-name"
                      value={editForm.name}
                      onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label htmlFor="edit-age">Age</Label>
                      <Input
                        id="edit-age"
                        type="number"
                        value={editForm.age}
                        onChange={e => setEditForm(p => ({ ...p, age: e.target.value }))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-height">Height (in)</Label>
                      <Input
                        id="edit-height"
                        type="number"
                        value={editForm.height}
                        onChange={e => setEditForm(p => ({ ...p, height: e.target.value }))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-weight">Weight</Label>
                      <Input
                        id="edit-weight"
                        type="number"
                        value={editForm.weight}
                        onChange={e => setEditForm(p => ({ ...p, weight: e.target.value }))}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Fitness Level</Label>
                    <Select
                      value={editForm.fitnessLevel}
                      onValueChange={v => setEditForm(p => ({ ...p, fitnessLevel: v as "beginner" | "intermediate" | "advanced" }))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beginner">Beginner</SelectItem>
                        <SelectItem value="intermediate">Intermediate</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Health Profile */}
                <div className="pt-2 border-t border-border">
                  <p className="text-xs font-semibold text-foreground mb-1">Health Profile <span className="font-normal text-muted-foreground">(optional — for food guidance)</span></p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label>Blood Type</Label>
                      <Select
                        value={editForm.bloodType || ''}
                        onValueChange={v => setEditForm(p => ({ ...p, bloodType: v as UserProfile['bloodType'] | '' }))}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Not set</SelectItem>
                          <SelectItem value="A">A</SelectItem>
                          <SelectItem value="B">B</SelectItem>
                          <SelectItem value="AB">AB</SelectItem>
                          <SelectItem value="O">O</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Rh Factor</Label>
                      <Select
                        value={editForm.rhFactor || ''}
                        onValueChange={v => setEditForm(p => ({ ...p, rhFactor: v as UserProfile['rhFactor'] | '' }))}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Not set</SelectItem>
                          <SelectItem value="+">Positive (+)</SelectItem>
                          <SelectItem value="-">Negative (−)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Genotype</Label>
                      <Select
                        value={editForm.genotype || ''}
                        onValueChange={v => setEditForm(p => ({ ...p, genotype: v as UserProfile['genotype'] | '' }))}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Not set</SelectItem>
                          <SelectItem value="AA">AA</SelectItem>
                          <SelectItem value="AS">AS</SelectItem>
                          <SelectItem value="AC">AC</SelectItem>
                          <SelectItem value="SS">SS</SelectItem>
                          <SelectItem value="SC">SC</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">Guidance is based on peer-reviewed research (Harvard, NHLBI, ASH) — not the unvalidated "blood type diet".</p>
                </div>

                <Button className="w-full" onClick={handleSaveProfile} data-testid="button-save-profile">
                  <Check className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Stats */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="p-4" data-testid="card-stats">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-primary">{state.streak}</div>
                <div className="text-xs text-muted-foreground">Day Streak</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{state.workoutLogs.length}</div>
                <div className="text-xs text-muted-foreground">Workouts</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{state.personalRecords.length}</div>
                <div className="text-xs text-muted-foreground">PRs</div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Membership */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <h3 className="text-sm font-medium text-muted-foreground mb-2 px-1">Membership</h3>
          <Link href="/membership">
            <Card className="p-4 cursor-pointer hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Heart className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">RAIMZEAL · Foundation Plan</div>
                  <div className="text-sm text-muted-foreground">All features included, no subscription</div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </Card>
          </Link>
        </motion.div>

        {/* Health Tools */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.13 }}>
          <h3 className="text-sm font-medium text-muted-foreground mb-2 px-1">Health Tools</h3>
          <Card className="divide-y divide-border">
            <Link href="/settings/macros">
              <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Target className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">Macro Targets</div>
                  <div className="text-sm text-muted-foreground">Auto-calculated from your profile</div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </Link>
            <Link href="/sleep">
              <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                  <Moon className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">Sleep Tracking</div>
                  <div className="text-sm text-muted-foreground">Log nightly sleep and quality</div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </Link>
            <Link href="/progress/prs">
              <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">Personal Records</div>
                  <div className="text-sm text-muted-foreground">Your all-time bests, tracked</div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </Link>
            <Link href="/progress/photos">
              <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-pink-500/10 flex items-center justify-center">
                  <Camera className="w-5 h-5 text-pink-400" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">Progress Photos</div>
                  <div className="text-sm text-muted-foreground">Visual transformation timeline</div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </Link>
          </Card>
        </motion.div>

        {/* Preferences */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <h3 className="text-sm font-medium text-muted-foreground mb-2 px-1">Preferences</h3>
          <Card className="divide-y divide-border">
            <div className="flex items-center gap-3 p-4" data-testid="setting-dark-mode">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Moon className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="font-medium">Dark Mode</div>
                <div className="text-sm text-muted-foreground">Use dark theme</div>
              </div>
              <Switch
                checked={state.settings.darkMode}
                onCheckedChange={v => onUpdateSettings({ darkMode: v })}
              />
            </div>

            <div className="flex items-center gap-3 p-4" data-testid="setting-text-size">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Type className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="font-medium">Text Size</div>
                <div className="text-sm text-muted-foreground">Adjust reading comfort</div>
              </div>
              <Select
                value={state.settings.textSize}
                onValueChange={v => onUpdateSettings({ textSize: v as AppState['settings']['textSize'] })}
              >
                <SelectTrigger className="w-28 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3 p-4" data-testid="setting-notifications">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Bell className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="font-medium">Notifications</div>
                <div className="text-sm text-muted-foreground">Workout reminders</div>
              </div>
              <Switch
                checked={state.settings.notifications}
                onCheckedChange={v => onUpdateSettings({ notifications: v })}
              />
            </div>
          </Card>
        </motion.div>

        {/* Units */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <h3 className="text-sm font-medium text-muted-foreground mb-2 px-1">Units</h3>
          <Card className="divide-y divide-border">
            <div className="flex items-center gap-3 p-4" data-testid="setting-weight-unit">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Scale className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="font-medium">Weight Unit</div>
                <div className="text-sm text-muted-foreground">
                  {state.settings.weightUnit === 'kg' ? 'Kilograms (kg)' : 'Pounds (lbs)'}
                </div>
              </div>
              <Select
                value={state.settings.weightUnit}
                onValueChange={v => onUpdateSettings({ weightUnit: v as 'lbs' | 'kg' })}
              >
                <SelectTrigger className="w-24 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lbs">lbs</SelectItem>
                  <SelectItem value="kg">kg</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>
        </motion.div>


        {/* Support the Mission */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
          <Card className="p-4 border-primary/20 bg-primary/5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">The Foundation Plan is free forever — no subscription, no catch.</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  RAIMZEAL is free forever, built for fitness, food therapy, wellness, and healthcare support. Donations keep the staff and platform running for everyone.
                </p>
                <a
                  href={RAIMZY_LINKTREE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-1.5 text-xs text-secondary hover:underline"
                >
                  Books · Music · Courses · Coaching at linktr.ee/Raimzy
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              {DONATION_ACTIVE ? (
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <motion.button
                    onClick={async () => {
                      const popup = window.open('about:blank', '_blank');
                      if (!popup) {
                        setSettingsDonationError(true);
                        setTimeout(() => setSettingsDonationError(false), 5000);
                        return;
                      }
                      try {
                        const r = await fetch('/api/stripe/donation-health');
                        const { ok } = await r.json() as { ok: boolean };
                        if (!ok) throw new Error('unhealthy');
                        popup.location.href = STRIPE_DONATION_URL;
                        setSettingsDonationError(false);
                      } catch {
                        popup.close();
                        setSettingsDonationError(true);
                        setTimeout(() => setSettingsDonationError(false), 5000);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold cursor-pointer"
                    animate={{ scale: [1, 1.07, 1, 1.07, 1] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', repeatDelay: 4 }}
                    aria-label="Donate to support RAIMZEAL"
                  >
                    <Heart className="w-3.5 h-3.5 fill-current" />
                    Donate
                  </motion.button>
                  {settingsDonationError && (
                    <p className="text-xs text-destructive text-right">Donation link temporarily unavailable — please try again shortly.</p>
                  )}
                </div>
              ) : (
                <p className="shrink-0 text-xs text-muted-foreground italic text-right">Donation link<br />coming soon.</p>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Export Data */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.29 }}>
          <Card className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Export Your Records</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Download a full report of your workouts, meals, measurements, water intake, and personal records.
                </p>
              </div>
              <button
                onClick={handleExportData}
                disabled={exportLoading}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold cursor-pointer disabled:opacity-50"
                aria-label="Export your fitness data"
              >
                <Download className="w-3.5 h-3.5" />
                {exportLoading ? 'Generating…' : 'Export'}
              </button>
            </div>
          </Card>
        </motion.div>

        {/* Profile & Account */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.295 }}>
          <h3 className="text-sm font-medium text-muted-foreground mb-2 px-1">Profile & Account</h3>
          <Card className="divide-y divide-border">
            <Link href="/settings/public-profile">
              <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">Public Profile</div>
                  <div className="text-sm text-muted-foreground">Share your handle and fitness journey</div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </Link>
            <Link href="/settings/delete-account">
              <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-destructive/70" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-destructive/80">Delete Account</div>
                  <div className="text-sm text-muted-foreground">Permanently remove all your data</div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </Link>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Button
            variant="destructive"
            className="w-full"
            onClick={onLogout}
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center text-xs text-muted-foreground pt-4"
        >
          <div className="flex items-center justify-center gap-4 mb-3">
            <Link href="/privacy" className="text-primary hover:underline font-medium">
              Privacy Policy
            </Link>
            <span>·</span>
            <Link href="/terms" className="text-primary hover:underline font-medium">
              Terms of Service
            </Link>
          </div>
          <p>© 2026 RAIMZEAL · ECONTEUR LLC</p>
          <p className="mt-1">
            Created and powered by{' '}
            <a
              href="https://www.econteur.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              ECONTEUR LLC
            </a>
            {' '}· www.econteur.com
          </p>
        </motion.div>
      </div>
      <BottomNav />
    </div>
  );
}
