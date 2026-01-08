import { motion } from 'framer-motion';
import { Link } from 'wouter';
import { 
  ChevronLeft, ChevronRight, User, Moon, Type, Bell, 
  Download, Shield, LogOut, Dumbbell
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { BottomNav } from '@/components/BottomNav';
import { cn } from '@/lib/utils';
import type { AppState } from '@/lib/store';

interface SettingsProps {
  state: AppState;
  onUpdateSettings: (settings: Partial<AppState['settings']>) => void;
  onExportData: () => void;
  onLogout: () => void;
}

export function Settings({ state, onUpdateSettings, onExportData, onLogout }: SettingsProps) {
  const user = state.user;

  const settingsGroups = [
    {
      title: 'Preferences',
      items: [
        {
          icon: Moon,
          label: 'Dark Mode',
          description: 'Use dark theme',
          type: 'toggle' as const,
          value: state.settings.darkMode,
          onChange: (v: boolean) => onUpdateSettings({ darkMode: v }),
        },
        {
          icon: Type,
          label: 'Text Size',
          description: state.settings.textSize.charAt(0).toUpperCase() + state.settings.textSize.slice(1),
          type: 'link' as const,
        },
        {
          icon: Bell,
          label: 'Notifications',
          description: 'Workout reminders',
          type: 'toggle' as const,
          value: state.settings.notifications,
          onChange: (v: boolean) => onUpdateSettings({ notifications: v }),
        },
      ],
    },
    {
      title: 'Units',
      items: [
        {
          icon: Dumbbell,
          label: 'Weight Unit',
          description: user?.units === 'metric' ? 'Kilograms (kg)' : 'Pounds (lbs)',
          type: 'link' as const,
        },
      ],
    },
    {
      title: 'Data & Privacy',
      items: [
        {
          icon: Download,
          label: 'Export Data',
          description: 'Download all your data as JSON',
          type: 'action' as const,
          onAction: onExportData,
        },
        {
          icon: Shield,
          label: 'Privacy',
          description: 'Manage your privacy settings',
          type: 'link' as const,
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-4 pt-6 pb-4 space-y-6 max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold font-display">Profile</h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="p-4" data-testid="card-profile">
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16">
                <AvatarFallback className="text-xl bg-primary/20 text-primary">
                  {user?.name?.split(' ').map(n => n[0]).join('') || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-xl font-bold" data-testid="text-name">{user?.name || 'User'}</h2>
                <p className="text-muted-foreground" data-testid="text-email">{user?.email}</p>
                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                  <span>{user?.age} yrs</span>
                  <span>·</span>
                  <span>{user?.fitnessLevel}</span>
                </div>
              </div>
              <Button variant="outline" size="sm">
                Edit
              </Button>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
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

        {settingsGroups.map((group, groupIdx) => (
          <motion.div
            key={group.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + groupIdx * 0.05 }}
          >
            <h3 className="text-sm font-medium text-muted-foreground mb-2 px-1">{group.title}</h3>
            <Card className="divide-y divide-border">
              {group.items.map((item, itemIdx) => (
                <div
                  key={item.label}
                  className={cn(
                    'flex items-center gap-3 p-4',
                    (item.type === 'link' || item.type === 'action') && 'cursor-pointer hover:bg-muted/50 transition-colors'
                  )}
                  onClick={item.type === 'action' ? item.onAction : undefined}
                  data-testid={`setting-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <item.icon className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{item.label}</div>
                    <div className="text-sm text-muted-foreground">{item.description}</div>
                  </div>
                  {item.type === 'toggle' && (
                    <Switch
                      checked={item.value}
                      onCheckedChange={item.onChange}
                    />
                  )}
                  {(item.type === 'link' || item.type === 'action') && (
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              ))}
            </Card>
          </motion.div>
        ))}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
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
          <p>APEX Fitness v1.0.0</p>
          <p className="mt-1">Made with 💪 for fitness enthusiasts</p>
        </motion.div>
      </div>
      <BottomNav />
    </div>
  );
}