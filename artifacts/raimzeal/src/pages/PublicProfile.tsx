import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRoute, Link } from 'wouter';
import { User, Calendar, Target, Loader2, ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { BottomNav } from '@/components/BottomNav';

interface PublicProfileData {
  handle: string;
  name: string;
  goals?: string[];
  fitness_level?: string;
  member_since: string;
}

const GOAL_LABELS: Record<string, string> = {
  lose_weight: 'Lose weight',
  build_muscle: 'Build muscle',
  improve_endurance: 'Endurance',
  gain_weight: 'Gain weight',
  general_fitness: 'General fitness',
};

export function PublicProfile() {
  const [, params] = useRoute('/u/:handle');
  const handle = params?.handle ?? '';

  const [profile, setProfile] = useState<PublicProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!handle) return;
    setLoading(true);
    fetch(`/api/profile/${handle}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: { profile: PublicProfileData }) => setProfile(data.profile))
      .catch(code => { if (code === 404) setNotFound(true); })
      .finally(() => setLoading(false));
  }, [handle]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6">
        <div className="text-4xl">🤷</div>
        <h1 className="text-xl font-bold">Profile not found</h1>
        <p className="text-sm text-muted-foreground text-center">
          @{handle} hasn't enabled their public profile, or the handle doesn't exist.
        </p>
        <Link href="/" className="text-primary text-sm hover:underline">← Back to RAIMZEAL</Link>
      </div>
    );
  }

  const memberSince = new Date(profile.member_since).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-background pb-nav">
      <div className="max-w-lg mx-auto px-4 pt-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/">
            <button className="p-2 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
              <ArrowLeft className="h-5 w-5 text-muted-foreground" />
            </button>
          </Link>
          <p className="text-sm text-muted-foreground">@{profile.handle}</p>
        </div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-6 mb-4 text-center border-primary/20">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <User className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-0.5">{profile.name}</h1>
            <p className="text-muted-foreground text-sm">@{profile.handle}</p>
            {profile.fitness_level && (
              <span className="inline-block mt-2 px-3 py-1 text-xs font-semibold rounded-full bg-primary/10 text-primary capitalize">
                {profile.fitness_level}
              </span>
            )}
          </Card>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Member since</span>
              </div>
              <div className="text-sm font-semibold">{memberSince}</div>
            </Card>
            {profile.goals && profile.goals.length > 0 && (
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Goals</span>
                </div>
                <div className="text-sm font-semibold">
                  {profile.goals.map(g => GOAL_LABELS[g] ?? g).join(', ')}
                </div>
              </Card>
            )}
          </div>

          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              Built with{' '}
              <a href="/" className="text-primary font-semibold hover:underline">RAIMZEAL</a>
              {' '}— free fitness & health platform by Dr. Ephraim Oviawe
            </p>
          </div>
        </motion.div>
      </div>
      <BottomNav />
    </div>
  );
}
