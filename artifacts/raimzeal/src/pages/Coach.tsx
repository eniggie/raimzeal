import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'wouter';
import { AlertTriangle, ChevronLeft, Send, User, Globe, Sparkles, Mic, MicOff } from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { AppState } from '@/lib/store';
import { useAuth } from '@/contexts/AuthContext';
import { coachMessagesApi } from '@/lib/apiClient';
import { supabaseConfigured } from '@/lib/supabase';

interface CoachProps {
  state: AppState;
}

interface Message {
  id: string;
  role: 'user' | 'coach';
  content: string;
  timestamp: Date;
  isWeekly?: boolean;
  saveState?: 'saving' | 'saved' | 'failed';
}

async function saveWithRetry(
  fn: () => Promise<unknown>,
  maxAttempts = 3,
): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await fn();
      return;
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts - 1) {
        await new Promise<void>((res) => setTimeout(res, 1000 * Math.pow(2, attempt)));
      }
    }
  }
  throw lastErr;
}

function buildUserContext(state: AppState) {
  const today = new Date().toISOString().split('T')[0];
  const todayMeals = state.mealLogs.filter((m) => m.date === today);
  const todayCalories = todayMeals.reduce((s, m) => s + m.calories, 0);
  const todayProtein = todayMeals.reduce((s, m) => s + m.protein, 0);
  const todayCarbs = todayMeals.reduce((s, m) => s + m.carbs, 0);
  const todayFat = todayMeals.reduce((s, m) => s + m.fat, 0);
  const todayWater = state.waterIntake.find((w) => w.date === today)?.glasses ?? 0;
  const latestMeasurement = state.bodyMeasurements[0] ?? null;

  const mealBreakdown = todayMeals.reduce<Record<string, { count: number; calories: number }>>(
    (acc, m) => {
      const key = m.mealType ?? 'meal';
      if (!acc[key]) acc[key] = { count: 0, calories: 0 };
      acc[key].count++;
      acc[key].calories += m.calories;
      return acc;
    },
    {}
  );

  const recentWorkouts = state.workoutLogs.slice(0, 5).map((w) => ({
    name: w.workoutName,
    calories: w.caloriesBurned,
    date: w.date,
    duration: w.duration,
  }));

  return {
    name: state.user?.name ?? '',
    goals: state.user?.goals ?? [],
    weight: state.user?.weight ?? null,
    height: state.user?.height ?? null,
    age: state.user?.age ?? null,
    units: state.user?.units ?? 'imperial',
    fitnessLevel: state.user?.fitnessLevel ?? 'intermediate',
    streak: state.streak,
    recentWorkouts,
    todayCalories: todayCalories || null,
    todayProtein: todayProtein || null,
    todayCarbs: todayCarbs || null,
    todayFat: todayFat || null,
    todayWaterGlasses: todayWater,
    mealBreakdown: Object.keys(mealBreakdown).length > 0 ? mealBreakdown : null,
    latestBodyMeasurement: latestMeasurement
      ? {
          date: latestMeasurement.date,
          weight: latestMeasurement.weight,
          waist: latestMeasurement.waist,
          chest: latestMeasurement.chest,
          arms: latestMeasurement.arms,
          thighs: latestMeasurement.thighs,
          hips: latestMeasurement.hips,
        }
      : null,
    personalRecords: state.personalRecords.slice(0, 5),
  };
}

function buildWelcomeMessage(state: AppState): string {
  const firstName = state.user?.name?.split(' ')[0] ?? 'Champion';
  const streak = state.streak;
  const goals = state.user?.goals ?? [];
  const goalText = goals.length > 0
    ? `Your goals are clear: ${goals.join(', ')}.`
    : 'Let us start by setting some clear goals for you.';

  const streakLine = streak > 0
    ? `You are on a ${streak}-day streak and that kind of consistency is what separates people who talk about change from those who actually make it happen.`
    : 'Every great streak starts with a single day. Let this be yours.';

  return `Welcome back, ${firstName}. I am Ovia AI, your personal fitness coach, wellness guide, and mindset mentor.\n\n${streakLine}\n\n${goalText} I have full access to your training history, nutrition data, and measurements. Every answer I give you is built around your real numbers, not generic advice.\n\nWhat are we working on today?`;
}

const SUGGESTIONS = [
  'What should I eat today to hit my goals?',
  'Design me a workout for this week',
  'How do I build muscle faster?',
  'I need motivation right now',
  'Best supplements for my goals?',
  'How do I improve my recovery?',
];

const WEEKLY_KEY = 'raimzeal_ovia_weekly_date';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s*/g, '')                        // # headings
    .replace(/\*{1,3}([^*]*)\*{1,3}/g, '$1')          // *bold* **bold** ***bold***
    .replace(/_{1,2}([^_]*)_{1,2}/g, '$1')             // _italic_ __bold__
    .replace(/^[\s]*\d+\.\s+/gm, '')                  // 1. numbered lists
    .replace(/^[\s]*[-]{2,}[\s]*/gm, '')               // -- list items
    .replace(/^[\s]*[*]\s+/gm, '')                     // * list items
    .replace(/^[\s]*[-]\s+/gm, '')                     // - list items
    .replace(/`{1,3}[^`]*`{1,3}/g, (m) => m.replace(/`/g, '')) // `code`
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')           // [text](url)
    .replace(/\n{3,}/g, '\n\n')                        // collapse excess blank lines
    .replace(/[–—]/g, ' ')                             // en-dash / em-dash
    .replace(/\*/g, '')                                // catch-all: remove remaining asterisks
    .replace(/>+\s*/g, '')                             // > blockquotes
    .trim();
}

export function Coach({ state }: CoachProps) {
  const { session } = useAuth();
  const firstName = state.user?.name?.split(' ')[0] ?? 'Champion';

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'coach',
      content: buildWelcomeMessage(state),
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [searchingFor, setSearchingFor] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [voiceSupported, setVoiceSupported] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<unknown>(null);
  const historyLoadedRef = useRef(false);

  // Check browser voice support on mount
  useEffect(() => {
    type AnyRec = Record<string, unknown>;
    const w = window as unknown as AnyRec;
    const SR = w['SpeechRecognition'] ?? w['webkitSpeechRecognition'];
    setVoiceSupported(!!SR);
  }, []);

  // Load persisted conversation history from the server on first open
  useEffect(() => {
    if (!session?.access_token || !supabaseConfigured) return;
    if (historyLoadedRef.current) return;
    historyLoadedRef.current = true;

    coachMessagesApi.list(60).then(({ messages: history }) => {
      if (history.length === 0) return;
      const welcome: Message = {
        id: '1',
        role: 'coach',
        content: buildWelcomeMessage(state),
        timestamp: new Date(),
      };
      setMessages((prev) => {
        // Only preserve messages explicitly marked failed — those are definitively
        // not on the server. Server IDs are generated server-side so they can
        // never be matched by client UUID; any other comparison risks duplicates.
        const failedLocal = prev.filter((m) => m.saveState === 'failed');
        return [
          welcome,
          ...history.map((m) => ({
            id: m.id,
            role: m.role as 'user' | 'coach',
            content: m.content,
            timestamp: new Date(m.created_at),
            isWeekly: m.is_weekly,
            saveState: 'saved' as const,
          })),
          ...failedLocal,
        ];
      });
    }).catch(() => { /* best-effort — local welcome message stays if load fails */ });
  }, [session?.access_token]); // eslint-disable-line react-hooks/exhaustive-deps

  function stopVoice() {
    const rec = recognitionRef.current as Record<string, unknown> | null;
    if (rec) (rec['stop'] as () => void)();
    setIsListening(false);
    setInterimTranscript('');
  }

  function startVoice() {
    type AnyRec = Record<string, unknown>;
    const w = window as unknown as AnyRec;
    const SR = (w['SpeechRecognition'] ?? w['webkitSpeechRecognition']) as (new () => AnyRec) | undefined;
    if (!SR) { setVoiceSupported(false); return; }

    if (isListening) { stopVoice(); return; }

    const rec: AnyRec = new SR();
    rec['continuous'] = true;
    rec['interimResults'] = true;
    rec['lang'] = 'en-US';

    rec['onresult'] = (e: unknown) => {
      const event = e as AnyRec;
      const results = event['results'] as { [i: number]: { [j: number]: { transcript: string }; isFinal: boolean }; length: number };
      const startIdx = event['resultIndex'] as number;
      let interim = '';
      for (let i = startIdx; i < results.length; i++) {
        const r = results[i];
        if (r.isFinal) {
          const t = r[0].transcript.trim();
          if (t) setInput(prev => prev ? `${prev} ${t}` : t);
        } else {
          interim += r[0].transcript;
        }
      }
      setInterimTranscript(interim);
    };

    rec['onerror'] = () => { setIsListening(false); setInterimTranscript(''); };
    rec['onend'] = () => { setIsListening(false); setInterimTranscript(''); };

    recognitionRef.current = rec;
    (rec['start'] as () => void)();
    setIsListening(true);
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Weekly digest — fires once per 7 days on first open
  useEffect(() => {
    let cancelled = false;

    async function checkWeeklyDigest() {
      if (!session?.access_token) return;
      try {
        const lastStr = localStorage.getItem(WEEKLY_KEY);
        const now = Date.now();
        const shouldSend = !lastStr || now - parseInt(lastStr, 10) >= WEEK_MS;
        if (!shouldSend || cancelled) return;

        localStorage.setItem(WEEKLY_KEY, now.toString());
        if (cancelled) return;
        setIsTyping(true);

        const userCtx = buildUserContext(state);
        const response = await fetch('/api/ovia/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ messages: [], userContext: userCtx, weeklyDigest: true }),
        });

        if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const json = JSON.parse(line.slice(6)) as { content?: string; done?: boolean };
              if (json.content) fullContent += json.content;
              if (json.done) break;
            } catch { /* skip */ }
          }
        }

        if (cancelled) return;
        const cleaned = stripMarkdown(fullContent);
        if (cleaned) {
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: 'coach',
              content: cleaned,
              timestamp: new Date(),
              isWeekly: true,
            },
          ]);

          // Weekly digest persistence is intentionally best-effort and is
          // explicitly out-of-scope for the Task #523 message-save guarantee.
          // The digest is regenerated automatically on next open if missing,
          // so a silent failure here is acceptable. No saveState / retry UI.
          if (supabaseConfigured) {
            saveWithRetry(() =>
              coachMessagesApi.saveBatch([
                { role: 'coach', content: cleaned, is_weekly: true },
              ])
            ).catch(() => { /* intentionally silent — see comment above */ });
          }
        }
      } catch {
        // Weekly digest is best-effort — silent fail
        localStorage.removeItem(WEEKLY_KEY); // allow retry next open
      } finally {
        if (!cancelled) setIsTyping(false);
      }
    }

    const timer = setTimeout(checkWeeklyDigest, 1200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = useCallback(async (overrideText?: string) => {
    const trimmed = (overrideText ?? input).trim();
    if (!trimmed || isTyping) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
      saveState: supabaseConfigured ? 'saving' : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);
    setSearchingFor(null);

    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'coach', content: '', timestamp: new Date() },
    ]);

    abortRef.current = new AbortController();

    if (!session?.access_token) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: 'Please sign in to chat with Ovia AI.' }
            : m
        )
      );
      setIsTyping(false);
      return;
    }

    try {
      const allMessages = [...messages, userMessage].map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      }));

      const response = await fetch('/api/ovia/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: allMessages,
          userContext: buildUserContext(state),
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const err = response.status === 401
          ? 'Please sign in to chat with Ovia AI.'
          : `Connection error (${response.status}). Please try again.`;
        throw new Error(err);
      }
      if (!response.body) throw new Error('No response stream');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamDone = false;
      // Accumulate raw streamed text in a plain local variable so we can
      // persist it reliably without depending on React state updater timing.
      let rawStreamedContent = '';

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const json = JSON.parse(line.slice(6)) as {
              content?: string;
              searching?: string;
              done?: boolean;
              error?: string;
            };

            if (json.searching) setSearchingFor(json.searching);

            if (json.content) {
              rawStreamedContent += json.content;
              setSearchingFor(null);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + json.content }
                    : m
                )
              );
            }

            if (json.done || json.error) {
              streamDone = true;
              break;
            }
          } catch { /* skip malformed chunk */ }
        }
      }

      // Strip markdown from the locally-accumulated string (source of truth)
      const cleanedCoachContent = stripMarkdown(rawStreamedContent);

      // Apply cleaned content to state
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: cleanedCoachContent } : m
        )
      );

      // Persist this exchange with retry — up to 3 attempts, 1 s / 2 s / 4 s back-off
      if (supabaseConfigured && cleanedCoachContent) {
        saveWithRetry(() =>
          coachMessagesApi.saveBatch([
            { role: 'user', content: trimmed },
            { role: 'coach', content: cleanedCoachContent },
          ])
        ).then(() => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === userMessage.id || m.id === assistantId
                ? { ...m, saveState: 'saved' }
                : m
            )
          );
        }).catch(() => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === userMessage.id || m.id === assistantId
                ? { ...m, saveState: 'failed' }
                : m
            )
          );
        });
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        return;
      }
      const errorMsg = err instanceof Error ? err.message
        : `Sorry ${firstName}, I am having trouble connecting right now. Please check your connection and try again.`;
      // Mark the user message as failed so the retry chip appears — the exchange
      // was never saved because generation did not produce a valid response.
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === assistantId) return { ...m, content: errorMsg };
          if (m.id === userMessage.id && supabaseConfigured) return { ...m, saveState: 'failed' as const };
          return m;
        })
      );
    } finally {
      setIsTyping(false);
      setSearchingFor(null);
    }
  }, [input, isTyping, messages, state, session, firstName]);

  const handleRetrySave = useCallback(async (userMsgId: string) => {
    const idx = messages.findIndex((m) => m.id === userMsgId);
    if (idx === -1) return;
    const userMsg = messages[idx];
    const coachMsg = messages[idx + 1];
    if (!coachMsg || coachMsg.role !== 'coach') return;

    setMessages((prev) =>
      prev.map((m) =>
        m.id === userMsgId || m.id === coachMsg.id ? { ...m, saveState: 'saving' } : m
      )
    );

    try {
      await saveWithRetry(() =>
        coachMessagesApi.saveBatch([
          { role: 'user', content: userMsg.content },
          { role: 'coach', content: coachMsg.content },
        ])
      );
      setMessages((prev) =>
        prev.map((m) =>
          m.id === userMsgId || m.id === coachMsg.id ? { ...m, saveState: 'saved' } : m
        )
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === userMsgId || m.id === coachMsg.id ? { ...m, saveState: 'failed' } : m
        )
      );
    }
  }, [messages]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="px-4 py-4 border-b border-border glass sticky top-0 z-10">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3 flex-1">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
            </div>
            <div>
              <h1 className="font-semibold text-sm">Ovia AI</h1>
              <p className="text-xs text-primary">Fitness · Food Therapy · Wellness — not a medical substitute</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Globe className="w-3 h-3" />
            <span>AI-powered research</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="max-w-2xl mx-auto space-y-4 pb-4">
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={cn('flex gap-3', message.role === 'user' && 'flex-row-reverse')}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                  message.role === 'coach'
                    ? 'bg-primary/20 border border-primary/30'
                    : 'bg-primary/20 border border-primary/30'
                )}
              >
                {message.role === 'coach' ? (
                  <Sparkles className="w-4 h-4 text-primary" />
                ) : (
                  <User className="w-4 h-4 text-primary" />
                )}
              </div>
              <Card
                className={cn(
                  'p-3 max-w-[82%] shadow-none',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground border-primary/50'
                    : message.isWeekly
                    ? 'glass border-secondary/30 bg-secondary/5'
                    : 'glass'
                )}
              >
                {message.isWeekly && (
                  <p className="text-xs font-medium text-secondary mb-2 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Weekly Wellness Brief
                  </p>
                )}
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {message.content}
                  {message.role === 'coach' && message.content === '' && isTyping && (
                    <span className="inline-flex gap-0.5 ml-1">
                      {[0, 0.15, 0.3].map((delay, i) => (
                        <motion.span
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-muted-foreground inline-block"
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1, repeat: Infinity, delay }}
                        />
                      ))}
                    </span>
                  )}
                </p>
                {message.saveState === 'saving' && (
                  <p className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-pulse inline-block" />
                    Saving…
                  </p>
                )}
                {message.saveState === 'failed' && message.role === 'user' && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                    <span className="text-xs text-amber-400">Not saved</span>
                    <button
                      onClick={() => handleRetrySave(message.id)}
                      className="text-xs text-amber-400 underline hover:no-underline ml-0.5"
                    >
                      Retry
                    </button>
                  </div>
                )}
              </Card>
            </motion.div>
          ))}

          {/* Web search indicator */}
          <AnimatePresence>
            {searchingFor && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 px-2"
              >
                <Globe className="w-3.5 h-3.5 text-secondary animate-pulse" />
                <p className="text-xs text-muted-foreground">
                  Searching the web for:{' '}
                  <span className="text-secondary font-medium">{searchingFor}</span>
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Suggestions */}
          {messages.length === 1 && !isTyping && (
            <div className="flex flex-wrap gap-2 mt-2">
              {SUGGESTIONS.map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  onClick={() => handleSend(suggestion)}
                  className="text-xs h-8 glass border-border/50"
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border glass" style={{ paddingBottom: 'calc(1.75rem + env(safe-area-inset-bottom, 0px) + 4rem)' }}>
        <div className="max-w-2xl mx-auto space-y-2">

          {/* Voice recording indicator + interim transcript */}
          <AnimatePresence>
            {isListening && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-start gap-2 px-3 py-2 rounded-xl bg-destructive/10 border border-destructive/30"
              >
                <span className="flex items-center gap-1.5 shrink-0 mt-0.5">
                  <motion.span
                    className="w-2 h-2 rounded-full bg-destructive inline-block"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  />
                  <span className="text-xs font-semibold text-destructive">Recording</span>
                </span>
                <p className="text-xs text-muted-foreground flex-1 leading-relaxed">
                  {interimTranscript
                    ? <span className="text-foreground/70 italic">{interimTranscript}</span>
                    : 'Speak now… tap Stop when done'}
                </p>
                <button
                  onClick={stopVoice}
                  className="shrink-0 text-xs font-semibold text-destructive hover:underline"
                >
                  Stop
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Unsupported browser notice */}
          {!voiceSupported && (
            <p className="text-xs text-amber-400 text-center">
              Voice input is not supported in this browser. Try Chrome or Edge.
            </p>
          )}

          {/* Text input row */}
          <div className="flex gap-2 items-end">
            <Textarea
              placeholder={isListening ? 'Listening… keep speaking or tap Stop' : 'Ask about training, nutrition, food therapy, or health awareness…'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (isListening) stopVoice();
                  handleSend();
                }
              }}
              rows={1}
              className="resize-none min-h-[42px] max-h-32 text-sm"
              style={{ height: 'auto' }}
            />

            {/* Mic / Stop button */}
            <Button
              onClick={startVoice}
              size="icon"
              variant={isListening ? 'destructive' : 'outline'}
              disabled={!voiceSupported}
              className={cn(
                'shrink-0 h-[42px] w-[42px] transition-all',
                isListening && 'ring-2 ring-destructive ring-offset-2 ring-offset-background'
              )}
              title={isListening ? 'Stop recording' : voiceSupported ? 'Start voice input' : 'Voice not supported in this browser'}
            >
              {isListening
                ? <MicOff className="w-4 h-4" />
                : <Mic className="w-4 h-4" />}
            </Button>

            {/* Send button */}
            <Button
              onClick={() => { if (isListening) stopVoice(); handleSend(); }}
              disabled={!input.trim() || isTyping}
              size="icon"
              className="shrink-0 h-[42px] w-[42px]"
              title="Send message"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Ovia AI is for fitness, food therapy &amp; health awareness only. It does not replace any doctor, dietitian, or healthcare professional. Always consult a qualified professional for medical decisions. You are solely responsible for any action you take based on this app.
          </p>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
