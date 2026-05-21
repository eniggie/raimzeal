import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'wouter';
import {
  ChevronRight, Moon, Type, Bell,
  LogOut, Scale, Edit2, Check, X, Heart, ExternalLink
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
  const [editingProfile, setEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState({
    name: user?.name || '',
    age: user?.age?.toString() || '',
    height: user?.height?.toString() || '',
    weight: user?.weight?.toString() || '',
    fitnessLevel: user?.fitnessLevel || 'beginner',
  });

  const handleSaveProfile = () => {
    onUpdateProfile({
      name: editForm.name,
      age: parseInt(editForm.age) || user?.age || 0,
      height: parseInt(editForm.height) || user?.height || 0,
      weight: parseFloat(editForm.weight) || user?.weight || 0,
      fitnessLevel: editForm.fitnessLevel as UserProfile['fitnessLevel'],
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
                      try {
                        const r = await fetch('/api/stripe/donation-health');
                        const { ok } = await r.json() as { ok: boolean };
                        if (!ok) throw new Error('unhealthy');
                        window.open(STRIPE_DONATION_URL, '_blank', 'noopener,noreferrer');
                        setSettingsDonationError(false);
                      } catch {
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
          <p className="mt-1">Made with care for fitness enthusiasts</p>
        </motion.div>
      </div>
      <BottomNav />
    </div>
  );
}
