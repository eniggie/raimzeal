import { useState, useEffect, useCallback } from 'react';
import { Link } from 'wouter';
import { ChevronLeft, Trophy, FileText, Dumbbell, Users, Ribbon, Loader2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BottomNav } from '@/components/BottomNav';
import { cn } from '@/lib/utils';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type LegacyTab = 'leaderboard' | 'report' | 'plan' | 'partner' | 'certificate';
type TierName = 'foundation' | 'rise' | 'reign' | 'legacy';

interface LeaderboardEntry { id: string; name: string; handle: string | null; streak: number; workoutCount: number; }
interface HealthReport { id: string; periodLabel: string; content: string; createdAt: string; }
interface Partnership { partner: { id: string; name: string } | null; status: string; }
interface Certificate { name: string; handle: string | null; memberNumber: number; memberSince: string; }

async function getApiBase(): Promise<string> {
  return window.location.origin;
}

async function legacyFetch(path: string, opts?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  const base = await getApiBase();
  return fetch(`${base}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token ?? ''}`,
      ...(opts?.headers ?? {}),
    },
  });
}

export function Legacy() {
  const { user } = useAuth();
  const [tab, setTab] = useState<LegacyTab>('leaderboard');
  const [userTier, setUserTier] = useState<TierName>('foundation');
  const [tierLoading, setTierLoading] = useState(true);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lbLoading, setLbLoading] = useState(false);

  const [report, setReport] = useState<HealthReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [plan, setPlan] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(false);

  const [partnership, setPartnership] = useState<Partnership | null>(null);
  const [partnerLoading, setPartnerLoading] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const [cert, setCert] = useState<Certificate | null>(null);
  const [certLoading, setCertLoading] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured || !user?.id) { setTierLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.from('profiles').select('subscription_tier').eq('id', user.id).single();
        if (cancelled) return;
        const t = (data as Record<string, unknown> | null)?.['subscription_tier'] as string | null;
        setUserTier((t === 'rise' || t === 'reign' || t === 'legacy') ? t : 'foundation');
      } catch { /* stay on foundation */ }
      finally { if (!cancelled) setTierLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const loadLeaderboard = useCallback(async () => {
    setLbLoading(true);
    try {
      const res = await legacyFetch('/api/legacy/leaderboard');
      const data = await res.json() as { entries?: LeaderboardEntry[] };
      setLeaderboard(data.entries ?? []);
    } catch { setLeaderboard([]); }
    finally { setLbLoading(false); }
  }, []);

  const loadReport = useCallback(async () => {
    setReportLoading(true);
    try {
      const res = await legacyFetch('/api/legacy/health-report/latest');
      const data = await res.json() as { report?: HealthReport | null };
      setReport(data.report ?? null);
    } catch { setReport(null); }
    finally { setReportLoading(false); }
  }, []);

  const loadPartner = useCallback(async () => {
    setPartnerLoading(true);
    try {
      const res = await legacyFetch('/api/legacy/partner');
      const data = await res.json() as Partnership;
      setPartnership(data);
    } catch { setPartnership(null); }
    finally { setPartnerLoading(false); }
  }, []);

  const loadCertificate = useCallback(async () => {
    setCertLoading(true);
    try {
      const res = await legacyFetch('/api/legacy/certificate');
      const data = await res.json() as Certificate;
      setCert(data);
    } catch { setCert(null); }
    finally { setCertLoading(false); }
  }, []);

  useEffect(() => {
    if (userTier !== 'legacy') return;
    if (tab === 'leaderboard') loadLeaderboard();
    else if (tab === 'report') loadReport();
    else if (tab === 'partner') loadPartner();
    else if (tab === 'certificate') loadCertificate();
  }, [tab, userTier, loadLeaderboard, loadReport, loadPartner, loadCertificate]);

  async function handleGenerateReport() {
    setGenerating(true);
    try {
      const res = await legacyFetch('/api/legacy/health-report/generate', { method: 'POST' });
      const data = await res.json() as { report?: HealthReport; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setReport(data.report ?? null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not generate report.');
    }
    finally { setGenerating(false); }
  }

  async function handleGeneratePlan() {
    setPlanLoading(true);
    try {
      const res = await legacyFetch('/api/legacy/coaching-plan', { method: 'POST' });
      const data = await res.json() as { plan?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setPlan(data.plan ?? null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not generate plan.');
    }
    finally { setPlanLoading(false); }
  }

  async function handleRequestPartner() {
    setRequesting(true);
    try {
      const res = await legacyFetch('/api/legacy/partner/request', {
        method: 'POST',
        body: JSON.stringify({ userName: user?.user_metadata?.['name'] ?? user?.email ?? 'Legacy Member' }),
      });
      const data = await res.json() as { matched?: boolean; partner?: { id: string; name: string } | null; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      if (data.matched && data.partner) {
        alert(`You've been matched with ${data.partner.name}!`);
      } else {
        alert("You're in the queue. We'll match you with another Legacy member soon.");
      }
      await loadPartner();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not request partner.');
    }
    finally { setRequesting(false); }
  }

  async function handleEndPartnership() {
    if (!confirm('End this accountability partnership?')) return;
    await legacyFetch('/api/legacy/partner/end', { method: 'POST' });
    await loadPartner();
  }

  if (tierLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (userTier !== 'legacy') {
    return (
      <div className="min-h-screen bg-background flex flex-col pb-nav">
        <div className="px-4 py-4 border-b border-border sticky top-0 bg-background/80 backdrop-blur z-10">
          <div className="flex items-center gap-3 max-w-lg mx-auto">
            <Link href="/"><Button variant="ghost" size="icon"><ChevronLeft className="w-6 h-6" /></Button></Link>
            <h1 className="text-xl font-bold font-display flex-1">Legacy Inner Circle</h1>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-sm space-y-4">
            <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto">
              <Trophy className="w-8 h-8 text-yellow-500" />
            </div>
            <h2 className="text-2xl font-bold font-display">Legacy Exclusive</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              These features are reserved for Legacy members — the highest level of the RAIMZEAL community.
            </p>
            <Link href="/membership">
              <Button className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold w-full">
                Upgrade to Legacy
              </Button>
            </Link>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  const TABS: { key: LegacyTab; label: string; Icon: typeof Trophy }[] = [
    { key: 'leaderboard', label: 'Leaderboard', Icon: Trophy },
    { key: 'report',      label: 'Health Report', Icon: FileText },
    { key: 'plan',        label: 'My Plan',       Icon: Dumbbell },
    { key: 'partner',     label: 'Partner',       Icon: Users },
    { key: 'certificate', label: 'Certificate',   Icon: Ribbon },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col pb-nav">
      {/* Header */}
      <div className="px-4 py-4 border-b border-yellow-900/40 bg-gradient-to-r from-yellow-950/40 to-background sticky top-0 backdrop-blur z-10">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <Link href="/"><Button variant="ghost" size="icon"><ChevronLeft className="w-6 h-6" /></Button></Link>
          <Trophy className="w-5 h-5 text-yellow-500" />
          <h1 className="text-xl font-bold font-display text-yellow-400 flex-1">Legacy Inner Circle</h1>
          <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full font-semibold">LEGACY</span>
        </div>
      </div>

      {/* Tab row */}
      <div className="px-4 py-2 border-b border-border bg-muted/30 overflow-x-auto">
        <div className="flex gap-1 max-w-lg mx-auto min-w-max">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
                tab === key
                  ? 'bg-yellow-900/50 text-yellow-400'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-4 max-w-lg mx-auto w-full space-y-4">

        {/* LEADERBOARD */}
        {tab === 'leaderboard' && (
          <>
            <div>
              <h2 className="text-lg font-bold font-display">Legacy Leaderboard</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Top Legacy members ranked by streak and total workouts</p>
            </div>
            {lbLoading ? (
              <div className="flex justify-center pt-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : leaderboard.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm pt-8">No other Legacy members yet — you're first. 🏆</p>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((entry, i) => (
                  <Card key={entry.id} className={cn('p-3 flex items-center gap-3', i === 0 && 'border-yellow-500/40')}>
                    <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                      i === 0 ? 'bg-yellow-500 text-black' : i === 1 ? 'bg-gray-400 text-black' : i === 2 ? 'bg-amber-700 text-white' : 'bg-muted text-muted-foreground'
                    )}>
                      {i === 0 ? '🏆' : `#${i + 1}`}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{entry.name}</p>
                      {entry.handle && <p className="text-xs text-muted-foreground">@{entry.handle}</p>}
                    </div>
                    <div className="flex gap-3 text-center">
                      <div>
                        <p className="text-sm font-bold text-primary">{entry.streak}</p>
                        <p className="text-xs text-muted-foreground">streak</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-secondary">{entry.workoutCount}</p>
                        <p className="text-xs text-muted-foreground">workouts</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* HEALTH REPORT */}
        {tab === 'report' && (
          <>
            <div>
              <h2 className="text-lg font-bold font-display">Monthly Health Report</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Ovia AI analyses your data to generate a personalised monthly report</p>
            </div>
            <Button onClick={handleGenerateReport} disabled={generating} className="w-full">
              {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating…</> : 'Generate This Month\'s Report'}
            </Button>
            {reportLoading ? (
              <div className="flex justify-center pt-4"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : report ? (
              <Card className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-sm flex-1">{report.periodLabel}</span>
                  <span className="text-xs text-muted-foreground">{new Date(report.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{report.content}</p>
              </Card>
            ) : (
              <p className="text-center text-muted-foreground text-sm pt-4">No report yet. Generate your first one above.</p>
            )}
          </>
        )}

        {/* COACHING PLAN */}
        {tab === 'plan' && (
          <>
            <div>
              <h2 className="text-lg font-bold font-display">Personalised Coaching Plan</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Ovia AI builds a personalised 4-week training and nutrition plan</p>
            </div>
            <Button onClick={handleGeneratePlan} disabled={planLoading} className="w-full bg-purple-600 hover:bg-purple-500">
              {planLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Building your plan…</> : 'Generate My 4-Week Plan'}
            </Button>
            {plan && (
              <Card className="p-4 space-y-2 border-purple-500/30">
                <div className="flex items-center gap-2">
                  <Dumbbell className="w-4 h-4 text-purple-400" />
                  <span className="font-semibold text-sm">Your 4-Week Plan</span>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{plan}</p>
              </Card>
            )}
          </>
        )}

        {/* ACCOUNTABILITY PARTNER */}
        {tab === 'partner' && (
          <>
            <div>
              <h2 className="text-lg font-bold font-display">Accountability Partner</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Get matched with another Legacy member for mutual accountability</p>
            </div>
            {partnerLoading ? (
              <div className="flex justify-center pt-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : partnership?.status === 'active' && partnership.partner ? (
              <Card className="p-6 text-center space-y-3 border-primary/30">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Users className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-bold">{partnership.partner.name}</h3>
                <p className="text-xs text-muted-foreground">Your accountability partner</p>
                <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-semibold">
                  ✓ Active Partnership
                </span>
                <div className="pt-2">
                  <Button variant="outline" size="sm" onClick={handleEndPartnership} className="text-red-400 border-red-400/30 hover:bg-red-500/10">
                    End Partnership
                  </Button>
                </div>
              </Card>
            ) : partnership?.status === 'pending' ? (
              <Card className="p-6 text-center space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-secondary mx-auto" />
                <h3 className="font-semibold">Looking for your match…</h3>
                <p className="text-xs text-muted-foreground">You're in the queue. We'll notify you when another Legacy member is matched with you.</p>
              </Card>
            ) : (
              <>
                <Card className="p-6 text-center space-y-2">
                  <Users className="w-10 h-10 text-muted-foreground mx-auto" />
                  <h3 className="font-semibold">No partner yet</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">Match with a fellow Legacy member. You'll keep each other consistent and motivated.</p>
                </Card>
                <Button onClick={handleRequestPartner} disabled={requesting} className="w-full bg-secondary hover:bg-secondary/90 text-black font-bold">
                  {requesting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Finding your match…</> : 'Find My Accountability Partner'}
                </Button>
              </>
            )}
          </>
        )}

        {/* CERTIFICATE */}
        {tab === 'certificate' && (
          <>
            <div>
              <h2 className="text-lg font-bold font-display">Founding Member Certificate</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Your official recognition as a Legacy founder of RAIMZEAL</p>
            </div>
            {certLoading ? (
              <div className="flex justify-center pt-8"><Loader2 className="w-6 h-6 animate-spin text-yellow-500" /></div>
            ) : cert ? (
              <div className="relative rounded-2xl border-2 border-yellow-500/60 bg-gradient-to-b from-yellow-950/60 to-stone-950 p-8 text-center space-y-2 overflow-hidden">
                <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-yellow-500/60 rounded-tl-lg" />
                <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-yellow-500/60 rounded-br-lg" />
                <Ribbon className="w-10 h-10 text-yellow-500 mx-auto" />
                <h3 className="text-2xl font-black font-display tracking-widest text-yellow-400">RAIMZEAL</h3>
                <p className="text-xs tracking-widest text-yellow-600 uppercase">Legacy Founder Certificate</p>
                <div className="border-t border-yellow-500/20 my-3" />
                <p className="text-xs text-stone-400">This certifies that</p>
                <p className="text-2xl font-bold font-display text-yellow-100">{cert.name}</p>
                {cert.handle && <p className="text-sm text-yellow-600">@{cert.handle}</p>}
                <p className="text-xs text-stone-400">is a founding Legacy member</p>
                <div className="inline-block bg-yellow-500/10 border border-yellow-500/30 px-4 py-1.5 rounded-full mt-1">
                  <p className="text-sm font-bold text-yellow-400">Legacy Founder #{cert.memberNumber}</p>
                </div>
                <div className="border-t border-yellow-500/20 my-3" />
                <p className="text-xs text-stone-400">
                  Member since {new Date(cert.memberSince).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </p>
                <p className="text-xs text-stone-600">Fitness · Food Therapy · Healthcare Awareness</p>
                <p className="text-xs text-stone-600">raimzeal.com</p>
              </div>
            ) : (
              <p className="text-center text-muted-foreground text-sm pt-4">Could not load certificate.</p>
            )}
          </>
        )}

      </div>
      <BottomNav />
    </div>
  );
}
