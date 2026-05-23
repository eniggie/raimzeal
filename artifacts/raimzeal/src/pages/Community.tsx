import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'wouter';
import {
  ChevronLeft, Heart, MessageCircle, Send, Loader2, WifiOff, Users, RefreshCw,
  ExternalLink, BookOpen, ImagePlus, X, Trash2, ChevronDown, ChevronUp,
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
  user_id: string;
  user_name: string;
  content: string;
  post_type: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
  image_url?: string | null;
  _localLiked?: boolean;
  _localLikes?: number;
  _localCommentCount?: number;
}

interface LiveComment {
  id: string;
  post_id: string;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
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
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [pendingImagePreview, setPendingImagePreview] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Comments state
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());
  const [commentsMap, setCommentsMap] = useState<Record<string, LiveComment[]>>({});
  const [commentsLoading, setCommentsLoading] = useState<Set<string>>(new Set());
  const [newComments, setNewComments] = useState<Record<string, string>>({});
  const [commentPosting, setCommentPosting] = useState<Set<string>>(new Set());

  const loadPosts = useCallback(async () => {
    if (!supabaseConfigured) { setLoading(false); return; }
    setLoading(true);
    setFetchError('');
    try {
      const { data, error } = await supabase
        .from('community_posts')
        .select('id, user_id, user_name, content, post_type, likes_count, comments_count, created_at, image_url')
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      setPosts((data ?? []).map(p => ({
        ...p,
        _localLiked: false,
        _localLikes: p.likes_count,
        _localCommentCount: p.comments_count,
      })));
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

  const handleDeletePost = async (postId: string) => {
    if (!user) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;

    setPosts(prev => prev.filter(p => p.id !== postId));

    try {
      await fetch(`/api/community/posts/${postId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch { }
  };

  const loadComments = useCallback(async (postId: string) => {
    if (!supabaseConfigured) return;
    setCommentsLoading(prev => new Set(prev).add(postId));
    try {
      const { data, error } = await supabase
        .from('community_comments')
        .select('id, post_id, user_id, user_name, content, created_at')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      if (!error) {
        setCommentsMap(prev => ({ ...prev, [postId]: data ?? [] }));
      }
    } finally {
      setCommentsLoading(prev => { const s = new Set(prev); s.delete(postId); return s; });
    }
  }, []);

  const toggleComments = async (postId: string) => {
    setExpandedPosts(prev => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
        if (!commentsMap[postId]) {
          loadComments(postId);
        }
      }
      return next;
    });
  };

  const handleAddComment = async (postId: string) => {
    const content = (newComments[postId] ?? '').trim();
    if (!content || !user) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;

    const displayName = (user.user_metadata?.name as string | undefined)?.split(' ')[0]
      || user.email?.split('@')[0]
      || 'Member';

    setNewComments(prev => ({ ...prev, [postId]: '' }));
    setCommentPosting(prev => new Set(prev).add(postId));

    try {
      const res = await fetch(`/api/community/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userName: displayName, content }),
      });
      if (res.ok) {
        const { comment } = await res.json() as { comment: LiveComment };
        setCommentsMap(prev => ({
          ...prev,
          [postId]: [...(prev[postId] ?? []), comment],
        }));
        setPosts(prev => prev.map(p =>
          p.id === postId
            ? { ...p, _localCommentCount: (p._localCommentCount ?? p.comments_count) + 1 }
            : p
        ));
      }
    } catch { }
    setCommentPosting(prev => { const s = new Set(prev); s.delete(postId); return s; });
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    if (!user) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;

    setCommentsMap(prev => ({
      ...prev,
      [postId]: (prev[postId] ?? []).filter(c => c.id !== commentId),
    }));
    setPosts(prev => prev.map(p =>
      p.id === postId
        ? { ...p, _localCommentCount: Math.max(0, (p._localCommentCount ?? p.comments_count) - 1) }
        : p
    ));

    try {
      await fetch(`/api/community/posts/${postId}/comments/${commentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch { }
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

      let imageUrl: string | null = null;
      if (pendingImageFile) {
        setImageUploading(true);
        try {
          const ext = (pendingImageFile.name.split('.').pop() ?? 'jpg').toLowerCase();
          const urlRes = await fetch('/api/community/image-upload-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ ext }),
          });
          if (urlRes.ok) {
            const { uploadUrl, publicUrl } = await urlRes.json() as { uploadUrl: string; publicUrl: string };
            const putRes = await fetch(uploadUrl, {
              method: 'PUT',
              headers: { 'Content-Type': pendingImageFile.type || 'image/jpeg' },
              body: pendingImageFile,
            });
            if (putRes.ok) imageUrl = publicUrl;
          }
        } catch { }
        setImageUploading(false);
      }
      setPendingImageFile(null);
      setPendingImagePreview(null);

      const res = await fetch('/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userName: displayName, content, postType, imageUrl: imageUrl ?? undefined }),
      });
      if (res.ok) {
        const json = await res.json() as { post: Record<string, unknown> };
        const d = json.post;
        setPosts(prev => [{
          id: d.id as string,
          user_id: d.user_id as string,
          user_name: d.user_name as string,
          content: d.content as string,
          post_type: d.post_type as string,
          likes_count: 0,
          comments_count: 0,
          created_at: d.created_at as string,
          image_url: d.image_url as string | null | undefined,
          _localLiked: false,
          _localLikes: 0,
          _localCommentCount: 0,
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
        <Card className="p-4 glass shimmer">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-secondary/20 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-secondary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Resources from RAIMZY</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                RAIMZY — Dr. Ephraim Oviawe PHD, MBA, MTS, CST, AMA, DMIPRO, CSM, PMP — is the mind behind RAIMZEAL. Author, music artist, strategist, and coach.
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
          <Card className="p-3 glass text-center">
            <p className="text-xs font-semibold text-primary">Share Your Win</p>
            <p className="text-xs text-muted-foreground mt-1">Post a result, a milestone, or just show up. Every story matters.</p>
          </Card>
          <Card className="p-3 glass text-center">
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
              <Card className="p-3 glass">
                <p className="text-[10px] font-bold uppercase tracking-wider text-secondary mb-1">Food Therapy Tip of the Day</p>
                <p className="text-xs text-foreground/80 leading-relaxed">{foodTherapyTips[day]}</p>
              </Card>
              <Card className="p-3 glass">
                <p className="text-[10px] font-bold uppercase tracking-wider text-accent mb-1">Daily Health Question</p>
                <p className="text-xs text-foreground/80 leading-relaxed">{healthQuestions[day]}</p>
              </Card>
              <Card className="p-3 glass">
                <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1">Weekly Fitness Challenge</p>
                <p className="text-xs text-foreground/80 leading-relaxed">{challenges[day]}</p>
              </Card>
            </div>
          );
        })()}

        {/* Donation Prompt */}
        <Card className="p-3 glass flex items-center justify-between gap-3">
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
              <div className="flex-1 flex flex-col gap-2">
                <div className="flex gap-2">
                  <Input
                    placeholder={postType === 'win' ? 'Share your win or milestone...' : postType === 'question' ? 'Ask the community a health question...' : postType === 'tip' ? 'Share a food therapy or fitness tip...' : postType === 'challenge' ? 'Post a challenge for the community...' : 'Share your progress...'}
                    value={newPost}
                    onChange={e => setNewPost(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handlePost()}
                    data-testid="input-new-post"
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setPendingImageFile(file);
                      setPendingImagePreview(URL.createObjectURL(file));
                      e.target.value = '';
                    }}
                  />
                  <Button
                    variant="ghost" size="icon" type="button"
                    title="Attach image"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {imageUploading
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <ImagePlus className="w-4 h-4" />
                    }
                  </Button>
                  <Button onClick={handlePost} disabled={!newPost.trim() || posting} data-testid="button-post">
                    {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
                {pendingImagePreview && (
                  <div className="relative inline-flex self-start">
                    <img
                      src={pendingImagePreview}
                      alt="Attachment preview"
                      className="h-20 w-auto rounded-lg object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => { setPendingImageFile(null); setPendingImagePreview(null); }}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive flex items-center justify-center"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                )}
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

          {!loading && !fetchError && posts.map((post, i) => {
            const isOwn = user?.id === post.user_id;
            const isExpanded = expandedPosts.has(post.id);
            const comments = commentsMap[post.id] ?? [];
            const loadingComments = commentsLoading.has(post.id);
            const commentCount = post._localCommentCount ?? post.comments_count;

            return (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.4) }}
              >
                <Card className="p-4 glass-hover" data-testid={`post-${post.id}`}>
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
                            win:       { label: '🏆 Win',       cls: 'bg-primary/15 text-primary' },
                            question:  { label: '❓ Q&A',       cls: 'bg-secondary/20 text-secondary' },
                            tip:       { label: '💡 Tip',       cls: 'bg-accent/20 text-accent' },
                            challenge: { label: '🔥 Challenge', cls: 'bg-destructive/15 text-destructive' },
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
                        {isOwn && (
                          <button
                            type="button"
                            title="Delete post"
                            onClick={() => handleDeletePost(post.id)}
                            className="ml-1 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            data-testid={`delete-post-${post.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="text-sm whitespace-pre-wrap mb-3 leading-relaxed">{post.content}</p>
                      {post.image_url && (
                        <div className="relative w-full aspect-video rounded-lg overflow-hidden mb-3 bg-muted">
                          <div className="absolute inset-0 bg-muted animate-pulse" />
                          <img
                            src={post.image_url}
                            alt="Post attachment"
                            className="relative w-full h-full object-cover"
                            loading="lazy"
                            onLoad={(e) => { (e.currentTarget.previousElementSibling as HTMLElement).style.display = 'none'; }}
                          />
                        </div>
                      )}
                      <div className="flex items-center gap-4">
                        <Button
                          variant="ghost" size="sm" className="h-8 px-2"
                          onClick={() => handleLike(post.id)}
                          data-testid={`like-${post.id}`}
                        >
                          <Heart className={cn('w-4 h-4 mr-1', post._localLiked && 'fill-destructive text-destructive')} />
                          <span className="text-xs">{post._localLikes ?? post.likes_count}</span>
                        </Button>
                        <button
                          type="button"
                          onClick={() => toggleComments(post.id)}
                          className="flex items-center gap-1 h-8 px-2 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors text-xs"
                          data-testid={`toggle-comments-${post.id}`}
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>{commentCount}</span>
                          {isExpanded
                            ? <ChevronUp className="w-3 h-3 ml-0.5" />
                            : <ChevronDown className="w-3 h-3 ml-0.5" />
                          }
                        </button>
                      </div>

                      {/* Comments section */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="mt-3 pt-3 border-t border-border overflow-hidden"
                          >
                            {loadingComments && (
                              <div className="flex items-center justify-center py-4">
                                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                              </div>
                            )}
                            {!loadingComments && comments.length === 0 && (
                              <p className="text-xs text-muted-foreground py-2 text-center">No comments yet — be the first.</p>
                            )}
                            {!loadingComments && comments.length > 0 && (
                              <div className="space-y-2 mb-3">
                                {comments.map(comment => (
                                  <div key={comment.id} className="flex items-start gap-2 group">
                                    <Avatar className="w-6 h-6 shrink-0">
                                      <AvatarFallback className="text-[10px]">
                                        {comment.user_name[0]?.toUpperCase() ?? '?'}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0 bg-muted/40 rounded-lg px-2.5 py-1.5">
                                      <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-xs font-semibold truncate max-w-[100px]">{comment.user_name}</span>
                                        <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{formatTime(comment.created_at)}</span>
                                        {user?.id === comment.user_id && (
                                          <button
                                            type="button"
                                            title="Delete comment"
                                            onClick={() => handleDeleteComment(post.id, comment.id)}
                                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-destructive transition-all"
                                            data-testid={`delete-comment-${comment.id}`}
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        )}
                                      </div>
                                      <p className="text-xs leading-relaxed whitespace-pre-wrap">{comment.content}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {user && (
                              <div className="flex gap-2 mt-2">
                                <Avatar className="w-6 h-6 shrink-0">
                                  <AvatarFallback className="text-[10px]">
                                    {((user.user_metadata?.name as string | undefined)?.[0] || user.email?.[0] || 'Y').toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 flex gap-1.5">
                                  <Input
                                    className="h-7 text-xs"
                                    placeholder="Write a comment..."
                                    value={newComments[post.id] ?? ''}
                                    onChange={e => setNewComments(prev => ({ ...prev, [post.id]: e.target.value }))}
                                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAddComment(post.id)}
                                  />
                                  <Button
                                    size="sm"
                                    className="h-7 px-2"
                                    disabled={!(newComments[post.id] ?? '').trim() || commentPosting.has(post.id)}
                                    onClick={() => handleAddComment(post.id)}
                                  >
                                    {commentPosting.has(post.id)
                                      ? <Loader2 className="w-3 h-3 animate-spin" />
                                      : <Send className="w-3 h-3" />
                                    }
                                  </Button>
                                </div>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}

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
