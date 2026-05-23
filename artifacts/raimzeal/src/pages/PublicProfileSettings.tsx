import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Globe, Copy, Check, Loader2, Save } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { BottomNav } from '@/components/BottomNav';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

interface PublicProfileSettings {
  handle?: string | null;
  public_profile_enabled?: boolean;
  public_show_streak?: boolean;
  public_show_workouts?: boolean;
  public_show_badges?: boolean;
}

export function PublicProfileSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<PublicProfileSettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [handle, setHandle] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/user/public-profile', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as PublicProfileSettings;
      setSettings(data);
      setHandle(data.handle ?? '');
    } catch {
      toast({ title: 'Could not load profile settings', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const body: PublicProfileSettings = {
        ...settings,
        handle: handle.toLowerCase().trim() || null,
      };
      const res = await fetch('/api/user/public-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error);
      }
      setSettings(body);
      toast({ title: 'Public profile settings saved' });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Could not save', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  const profileUrl = handle ? `${window.location.origin}/u/${handle}` : null;

  async function copyLink() {
    if (!profileUrl) return;
    await navigator.clipboard.writeText(profileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const handleError = handle.length > 0 && (handle.length < 3 || !/^[a-z0-9_]+$/.test(handle))
    ? handle.length < 3
      ? 'Handle must be at least 3 characters'
      : 'Only lowercase letters, numbers, and underscores allowed'
    : null;

  return (
    <div className="min-h-screen bg-background" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 7rem)' }}>
      <div className="max-w-lg mx-auto px-4 pt-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/settings">
            <button className="p-2 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
              <ChevronLeft className="h-5 w-5 text-muted-foreground" />
            </button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">Public Profile</h1>
            <p className="text-sm text-muted-foreground">Share your fitness journey</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <Card className="divide-y divide-border">
              <div className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Globe className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">Public Profile</div>
                  <div className="text-sm text-muted-foreground">Allow others to view your profile page</div>
                </div>
                <Switch
                  checked={settings.public_profile_enabled ?? false}
                  onCheckedChange={v => setSettings(p => ({ ...p, public_profile_enabled: v }))}
                />
              </div>
            </Card>

            <Card className="p-4">
              <Label className="text-xs mb-2 block">Your handle</Label>
              <Input
                value={handle}
                onChange={e => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="yourhandle"
                maxLength={30}
                className="mb-2"
              />
              {handleError
                ? <p className="text-xs text-destructive">{handleError}</p>
                : <p className="text-xs text-muted-foreground">3–30 characters, lowercase letters, numbers, underscores only.</p>
              }
              {profileUrl && settings.public_profile_enabled && (
                <div className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                  <span className="text-xs text-muted-foreground truncate flex-1">{profileUrl}</span>
                  <button onClick={copyLink} className="shrink-0 p-1.5 rounded hover:bg-muted transition-colors">
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                  </button>
                </div>
              )}
            </Card>

            <Button onClick={handleSave} disabled={saving || !!handleError || (handle.length > 0 && handle.length < 3)} className="w-full">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save Settings
            </Button>
          </motion.div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
