import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'wouter';
import {
  ChevronRight, Moon, Type, Bell,
  LogOut, Scale, Edit2, Check, X, Heart, ExternalLink, Download
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

const STRIPE_DONATION_URL = 'https://donate.stripe.com/aFa6oH7GE50z37Xdmh6kg00';
const DONATION_ACTIVE = Boolean(
  STRIPE_DONATION_URL &&
  STRIPE_DONATION_URL.startsWith('https://donate.stripe.com/') &&
  !STRIPE_DONATION_URL.includes('PLACEHOLDER')
);
const RAIMZY_LINKTREE = 'https://linktr.ee/Raimzy';

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
      const rows = (arr: unknown[]) => arr.length;

      const tableRows = (items: { date: string; label: string; value: string }[]) =>
        items.map(r => `<tr><td>${r.date}</td><td>${r.label}</td><td>${r.value}</td></tr>`).join('');

      const workoutRows = state.workoutLogs.slice(0, 200).map(w => ({
        date: w.date ?? '',
        label: w.workoutName ?? '',
        value: w.duration ? `${w.duration} min` : '',
      }));

      const mealRows = state.mealLogs.slice(0, 200).map(m => ({
        date: m.date ?? '',
        label: m.name ?? '',
        value: `${m.calories ?? 0} kcal · P ${m.protein ?? 0}g · C ${m.carbs ?? 0}g · F ${m.fat ?? 0}g`,
      }));

      const bodyRows = state.bodyMeasurements.slice(0, 200).map(b => ({
        date: b.date ?? '',
        label: 'Body weight',
        value: `${b.weight ?? ''} ${wUnit}`,
      }));

      const waterRows = state.waterIntake.slice(0, 200).map(w => ({
        date: w.date ?? '',
        label: 'Water intake',
        value: `${w.glasses ?? 0} glasses`,
      }));

      const prRows = state.personalRecords.slice(0, 200).map(pr => ({
        date: pr.date ?? '',
        label: pr.exercise ?? '',
        value: `${pr.weight ?? ''} ${wUnit}`,
      }));

      const section = (title: string, rows: { date: string; label: string; value: string }[], emptyMsg: string) =>
        `<h2>${title}</h2>${rows.length
          ? `<table><thead><tr><th>Date</th><th>Activity</th><th>Details</th></tr></thead><tbody>${tableRows(rows)}</tbody></table>`
          : `<p class="empty">${emptyMsg}</p>`}`;

      const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>
<title>RAIMZEAL Data Export — ${u?.name ?? 'User'}</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:860px;margin:40px auto;padding:0 24px;color:#111;background:#fff}
  h1{font-size:1.6rem;margin-bottom:4px}
  .sub{color:#666;font-size:.85rem;margin-bottom:32px}
  h2{font-size:1.1rem;margin:28px 0 10px;border-bottom:1px solid #e5e7eb;padding-bottom:6px}
  .profile-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:8px}
  .pcard{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;text-align:center}
  .pcard .val{font-size:1.2rem;font-weight:700;color:#6d28d9}
  .pcard .lbl{font-size:.75rem;color:#666;margin-top:2px}
  table{width:100%;border-collapse:collapse;font-size:.875rem;margin-bottom:8px}
  th{background:#f3f4f6;text-align:left;padding:8px 10px;font-weight:600}
  td{padding:7px 10px;border-bottom:1px solid #f3f4f6}
  tr:last-child td{border-bottom:none}
  .empty{color:#9ca3af;font-size:.875rem;margin:0}
  .footer{margin-top:48px;text-align:center;font-size:.75rem;color:#9ca3af;border-top:1px solid #f3f4f6;padding-top:16px}
  @media print{body{margin:20px}}
</style></head><body>
<h1>RAIMZEAL — Data Export</h1>
<p class="sub">Exported on ${new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})} · ${u?.name ?? 'User'} · ${u?.email ?? ''}</p>

<h2>Profile</h2>
<div class="profile-grid">
  <div class="pcard"><div class="val">${u?.age ?? '—'}</div><div class="lbl">Age (yrs)</div></div>
  <div class="pcard"><div class="val">${u?.height ?? '—'}</div><div class="lbl">Height (cm)</div></div>
  <div class="pcard"><div class="val">${u?.weight ?? '—'} ${wUnit}</div><div class="lbl">Weight</div></div>
  <div class="pcard"><div class="val">${rows(state.workoutLogs)}</div><div class="lbl">Workouts logged</div></div>
  <div class="pcard"><div class="val">${rows(state.mealLogs)}</div><div class="lbl">Meals logged</div></div>
  <div class="pcard"><div class="val">${state.streak}</div><div class="lbl">Current streak</div></div>
</div>

${section('Workout History', workoutRows, 'No workouts logged yet.')}
${section('Nutrition / Meals', mealRows, 'No meals logged yet.')}
${section('Body Measurements', bodyRows, 'No measurements logged yet.')}
${section('Water Intake', waterRows, 'No water intake logged yet.')}
${section('Personal Records', prRows, 'No personal records yet.')}

<div class="footer">Created and powered by ECONTEUR LLC · www.econteur.com</div>
</body></html>`;

      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `raimzeal-export-${new Date().toISOString().slice(0, 10)}.html`;
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
                  <div className="font-medium">RAIMZEAL · Free Forever</div>
                  <div className="text-sm text-muted-foreground">All features included, no subscription</div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </Card>
          </Link>
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
                <p className="text-sm font-semibold">RAIMZEAL is free forever.</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  We turned down deals to keep it that way. If it has helped you, a donation supports the team.
                </p>
                <a
                  href={RAIMZY_LINKTREE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-1.5 text-xs text-secondary hover:underline"
                >
                  Resources at linktr.ee/Raimzy
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              {DONATION_ACTIVE ? (
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <button
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
                    aria-label="Donate to support RAIMZEAL"
                  >
                    <Heart className="w-3.5 h-3.5 fill-current" />
                    Donate
                  </button>
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
          <p>RAIMZEAL v1.2.0</p>
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
