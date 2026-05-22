import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'wouter';
import {
  ChevronLeft, Heart, MessageCircle, Send, Loader2, WifiOff, Users, RefreshCw, ExternalLink, BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { BottomNav } from '@/components/BottomNav';
import { cn } from '@/lib/utils';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { STRIPE_DONATION_URL, DONATION_ACTIVE, RAIMZY_LINKTREE } from '@/lib/constants';

interface LivePost {
  id: string;
  user_name: string;
  content: string;
  post_type: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
  _localLiked?: boolean;
  _localLikes?: number;
}

function formatTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return 'Just now';
}

export function Community() {
  const { user } = useAuth();
  const [communityDonationError, setCommunityDonationError] = useState(false);
  const [posts, setPosts] = useState<LivePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [newPost, setNewPost] = useState('');
  const [posting, setPosting] = useState(false);
  const [postType, setPostType] = useState<'post' | 'win' | 'question' | 'tip' | 'challenge'>('post');

  const loadPosts = useCallback(async () => {
    if (!supabaseConfigured) { setLoading(false); return; }
    setLoading(true);
    setFetchError('');
    try {
      const { data, error } = await supabase
        .from('community_posts')
        .select('id, user_name, content, post_type, likes_count, comments_count, created_at')
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      setPosts((data ?? []).map(p => ({ ...p, _localLiked: false, _localLikes: p.likes_count })));
    } catch {
      setFetchError("Couldn't load posts. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const handleLike = (postId: string) => {
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const wasLiked = p._localLiked ?? false;
      return { ...p, _localLiked: !wasLiked, _localLikes: (p._localLikes ?? p.likes_count) + (wasLiked ? -1 : 1) };
    }));
  };

  const handlePost = async () => {
    if (!newPost.trim() || !user) return;
    const content = newPost.trim();
    setNewPost('');
    setPosting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const displayName = (user.user_metadata?.name as string | undefined)?.split(' ')[0]
        || user.email?.split('@')[0]
        || 'Member';
      const res = await fetch('/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userName: displayName, content, postType }),
      });
      if (res.ok) {
        const json = await res.json() as { post: Record<string, unknown> };
        const d = json.post;
        setPosts(prev => [{
          id: d.id as string,
          user_name: d.user_name as string,
          content: d.content as string,
          post_type: d.post_type as string,
          likes_count: 0,
          comments_count: 0,
          created_at: d.created_at as string,
          _localLiked: false,
          _localLikes: 0,
        }, ...prev]);
      }
    } catch { }
    setPosting(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col pb-24">
      <div className="px-4 py-4 border-b border-border sticky top-0 bg-background/80 backdrop-blur z-10">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ChevronLeft className="w-6 h-6" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold font-display flex-1">Community</h1>
          {!loading && supabaseConfigured && (
            <Button variant="ghost" size="icon" onClick={loadPosts} title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Resources + Support Section */}
      <div className="px-4 pt-4 max-w-lg mx-auto w-full space-y-3">

        {/* RAIMZY Resources Card */}
        <Card className="p-4 border-secondary/30 bg-secondary/5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-secondary/20 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-secondary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Resources from RAIMZY</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                RAIMZY — Dr. Ephraim Oviawe — is the mind behind RAIMZEAL. Author, music artist, strategist, and coach.
              </p>
              <a
                href={RAIMZY_LINKTREE}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-xs text-secondary font-semibold hover:underline"
              >
                Visit linktr.ee/Raimzy
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </Card>

        {/* Support Prompts */}
        <div className="grid grid-cols-2 gap-2">
          <Card className="p-3 border-primary/20 bg-primary/5 text-center">
            <p className="text-xs font-semibold text-primary">Share Your Win</p>
            <p className="text-xs text-muted-foreground mt-1">Post a result, a milestone, or just show up. Every story matters.</p>
          </Card>
          <Card className="p-3 border-accent/20 bg-accent/5 text-center">
            <p className="text-xs font-semibold text-accent">Ask the Community</p>
            <p className="text-xs text-muted-foreground mt-1">Questions welcome. This community lifts each other up.</p>
          </Card>
        </div>

        {/* Curated Daily Content */}
        {(() => {
          const day = new Date().getDay();
          const foodTherapyTips = [
            "Ginger and turmeric tea reduces inflammation markers and supports joint health. Try a cup before bed tonight.",
            "Fermented foods like kefir, kimchi, and natural yoghurt seed your gut microbiome — the foundation of immunity and mood.",
            "Eating oily fish twice a week provides EPA and DHA that reduce systemic inflammation and feed your brain.",
            "Leafy greens are rich in folate and magnesium, which support serotonin production and reduce anxiety.",
            "Bone broth is packed with collagen, glycine, and minerals that heal the gut lining and support joint recovery.",
            "Berries are among the highest antioxidant foods on earth. A handful daily fights oxidative stress from training.",
            "Dark chocolate (70%+) raises endorphins and provides magnesium. One or two squares is therapeutic, not a treat.",
          ];
          const healthQuestions = [
            "What is one food you eat daily that you are unsure about? Drop it below — the community has answers.",
            "How many glasses of water did you drink yesterday? Share your hydration goal for today.",
            "What does your pre-workout meal look like? Let the community see what fuels you.",
            "What is the biggest nutrition myth you believed that turned out to be wrong?",
            "Which recovery habit has made the most difference in your training: sleep, nutrition, or rest days?",
            "What is one small lifestyle change that made a big difference to your energy levels?",
            "How do you handle cravings while staying on track? Share your strategy below.",
          ];
          const challenges = [
            "This week: add one extra serving of leafy greens to every meal. Who is in?",
            "Challenge: 10 minutes of morning movement before screens. Start tomorrow and report back.",
            "Try replacing one processed snack with a whole food this week. Share what you swapped.",
            "Drink 8 glasses of water every day this week. Drop a check-in comment to stay accountable.",
            "Go for a 20-minute walk after dinner every day this week. Tag a friend to join you.",
            "Meal prep at least two healthy meals this week. Post a photo when you do.",
            "No added sugar for 3 days. Start today — who is joining?",
          ];
          return (
            <div className="space-y-2">
              <Card className="p-3 border-secondary/20 bg-secondary/5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-secondary mb-1">Food Therapy Tip of the Day</p>
                <p className="text-xs text-foreground/80 leading-relaxed">{foodTherapyTips[day]}</p>
              </Card>
              <Card className="p-3 border-accent/20 bg-accent/5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-accent mb-1">Daily Health Question</p>
                <p className="text-xs text-foreground/80 leading-relaxed">{healthQuestions[day]}</p>
              </Card>
              <Card className="p-3 border-primary/20 bg-primary/5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1">Weekly Fitness Challenge</p>
                <p className="text-xs text-foreground/80 leading-relaxed">{challenges[day]}</p>
              </Card>
            </div>
          );
        })()}

        {/* Donation Prompt */}
        <Card className="p-3 border-primary/20 flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold">The Foundation Plan is free forever — no subscription, no catch.</p>
            <p className="text-xs text-muted-foreground mt-0.5">RAIMZEAL is free forever. If it has helped you, a voluntary donation keeps the staff and platform running for everyone. Books · Music · Courses · Coaching: <span className="font-semibold">linktr.ee/Raimzy</span></p>
          </div>
          {DONATION_ACTIVE ? (
            <div className="shrink-0 flex flex-col items-end gap-1">
              <motion.button
                onClick={async () => {
                  const popup = window.open('about:blank', '_blank');
                  if (!popup) {
                    setCommunityDonationError(true);
                    setTimeout(() => setCommunityDonationError(false), 5000);
                    return;
                  }
                  try {
                    const r = await fetch('/api/stripe/donation-health');
                    const { ok } = await r.json() as { ok: boolean };
                    if (!ok) throw new Error('unhealthy');
                    popup.location.href = STRIPE_DONATION_URL;
                    setCommunityDonationError(false);
                  } catch {
                    popup.close();
                    setCommunityDonationError(true);
                    setTimeout(() => setCommunityDonationError(false), 5000);
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold cursor-pointer"
                animate={{ scale: [1, 1.07, 1, 1.07, 1] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', repeatDelay: 5 }}
                aria-label="Donate to support RAIMZEAL"
              >
                <Heart className="w-3.5 h-3.5 fill-current" />
                Donate
              </motion.button>
              {communityDonationError && (
                <p className="text-xs text-destructive">Donation link temporarily unavailable — please try again shortly.</p>
              )}
            </div>
          ) : (
            <p className="shrink-0 text-xs text-muted-foreground italic">Donation link coming soon.</p>
          )}
        </Card>
      </div>

      {/* Post composer */}
      {user && supabaseConfigured && (
        <div className="px-4 py-4 border-b border-border">
          <div className="max-w-lg mx-auto">
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {(['post', 'win', 'question', 'tip', 'challenge'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setPostType(t)}
                  className={cn(
                    'text-xs px-2.5 py-1 rounded-full font-medium transition-colors border',
                    postType === t
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  )}
                >
                  {t === 'win' ? '🏆 Win' : t === 'question' ? '❓ Question' : t === 'tip' ? '💡 Tip' : t === 'challenge' ? '🔥 Challenge' : '💬 Post'}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
                <Avatar>
                  <AvatarFallback>
                    {((user.user_metadata?.name as string | undefined)?.[0] || user.email?.[0] || 'Y').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 flex gap-2">
                  <Input
                    placeholder={postType === 'win' ? 'Share your win or milestone...' : postType === 'question' ? 'Ask the community a health question...' : postType === 'tip' ? 'Share a food therapy or fitness tip...' : postType === 'challenge' ? 'Post a challenge for the community...' : 'Share your progress...'}
                    value={newPost}
                    onChange={e => setNewPost(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handlePost()}
                    data-testid="input-new-post"
                  />
                  <Button onClick={handlePost} disabled={!newPost.trim() || posting} data-testid="button-post">
                    {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">

          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-muted-foreground text-sm">Loading community posts...</p>
            </div>
          )}

          {!loading && !supabaseConfigured && (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center px-6">
              <WifiOff className="w-12 h-12 text-muted-foreground" />
              <h3 className="font-semibold">Community offline</h3>
              <p className="text-muted-foreground text-sm">
                The live community feed is unavailable. Open the RAIMZEAL mobile app for full community access.
              </p>
            </div>
          )}

          {!loading && supabaseConfigured && fetchError && (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
              <WifiOff className="w-12 h-12 text-destructive/60" />
              <h3 className="font-semibold">Could not load posts</h3>
              <p className="text-muted-foreground text-sm max-w-xs">{fetchError}</p>
              <Button variant="outline" size="sm" onClick={loadPosts}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Try again
              </Button>
            </div>
          )}

          {!loading && supabaseConfigured && !fetchError && posts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
              <Users className="w-12 h-12 text-muted-foreground" />
              <h3 className="font-semibold">No posts yet</h3>
              <p className="text-muted-foreground text-sm">Be the first to share your fitness journey.</p>
            </div>
          )}

          {!loading && !fetchError && posts.map((post, i) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.4) }}
            >
              <Card className="p-4" data-testid={`post-${post.id}`}>
                <div className="flex items-start gap-3">
                  <Avatar>
                    <AvatarFallback>
                      {post.user_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-sm truncate max-w-[140px]">{post.user_name}</span>
                      {post.post_type && post.post_type !== 'post' && (() => {
                        const t = post.post_type.toLowerCase();
                        const map: Record<string, { label: string; cls: string }> = {
                          win:      { label: '🏆 Win',       cls: 'bg-primary/15 text-primary' },
                          question: { label: '❓ Q&A',       cls: 'bg-secondary/20 text-secondary' },
                          tip:      { label: '💡 Tip',       cls: 'bg-accent/20 text-accent' },
                          challenge:{ label: '🔥 Challenge', cls: 'bg-destructive/15 text-destructive' },
                        };
                        const entry = map[t];
                        return entry ? (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${entry.cls}`}>
                            {entry.label}
                          </span>
                        ) : null;
                      })()}
                      <span className="text-xs text-muted-foreground ml-auto shrink-0">
                        {formatTime(post.created_at)}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap mb-3 leading-relaxed">{post.content}</p>
                    <div className="flex items-center gap-4">
                      <Button
                        variant="ghost" size="sm" className="h-8 px-2"
                        onClick={() => handleLike(post.id)}
                        data-testid={`like-${post.id}`}
                      >
                        <Heart className={cn('w-4 h-4 mr-1', post._localLiked && 'fill-destructive text-destructive')} />
                        <span className="text-xs">{post._localLikes ?? post.likes_count}</span>
                      </Button>
                      <div className="flex items-center gap-1 text-muted-foreground px-2">
                        <MessageCircle className="w-4 h-4" />
                        <span className="text-xs">{post.comments_count}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}

          {/* Footer encouragement */}
          {!loading && (
            <div className="pt-2 pb-4 text-center space-y-2">
              <p className="text-xs text-muted-foreground">
                Every member here is on a real journey. Be kind, be honest, be encouraging.
              </p>
              <a
                href={RAIMZY_LINKTREE}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-secondary hover:underline"
              >
                Books · Music · Courses · Coaching at linktr.ee/Raimzy
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
