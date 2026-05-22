import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'wouter';
import { ChevronLeft, Send, User, Globe, Sparkles, Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { AppState } from '@/lib/store';
import { useAuth } from '@/contexts/AuthContext';

interface CoachProps {
  state: AppState;
}

interface Message {
  id: string;
  role: 'user' | 'coach';
  content: string;
  timestamp: Date;
  isWeekly?: boolean;
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
    .replace(/#{1,6}\s*/g, '')         // # headings
    .replace(/\*{1,3}([^*]*)\*{1,3}/g, '$1') // *bold* **bold** ***bold***
    .replace(/_{1,2}([^_]*)_{1,2}/g, '$1')    // _italic_ __bold__
    .replace(/^[\s]*[-]{2,}[\s]*/gm, '')      // -- list items
    .replace(/^[\s]*[*]\s+/gm, '')            // * list items
    .replace(/^[\s]*[-]\s+/gm, '')            // - list items
    .replace(/`{1,3}[^`]*`{1,3}/g, (m) => m.replace(/`/g, '')) // `code`
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url)
    .replace(/\n{3,}/g, '\n\n')              // collapse excess blank lines
    .replace(/\*/g, '')                       // catch-all: remove any remaining asterisks
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<unknown>(null);

  function startVoice() {
    type AnyRec = Record<string, unknown>;
    const w = window as unknown as AnyRec;
    const SR = (w['SpeechRecognition'] ?? w['webkitSpeechRecognition']) as (new () => AnyRec) | undefined;
    if (!SR) return;
    if (isListening) {
      const rec = recognitionRef.current as AnyRec | null;
      if (rec) (rec['stop'] as () => void)();
      setIsListening(false);
      return;
    }
    const rec: AnyRec = new SR();
    rec['continuous'] = false;
    rec['interimResults'] = false;
    rec['lang'] = 'en-US';
    rec['onresult'] = (e: unknown) => {
      const results = ((e as AnyRec)['results'] as AnyRec[][])[0];
      const transcript = String((results?.[0] as AnyRec | undefined)?.['transcript'] ?? '');
      if (transcript) setInput(prev => prev ? `${prev} ${transcript}` : transcript);
      setIsListening(false);
    };
    rec['onerror'] = () => setIsListening(false);
    rec['onend'] = () => setIsListening(false);
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

      // Strip any markdown that slipped through
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: stripMarkdown(m.content) } : m
        )
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        return;
      }
      const errorMsg = err instanceof Error ? err.message
        : `Sorry ${firstName}, I am having trouble connecting right now. Please check your connection and try again.`;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: errorMsg } : m
        )
      );
    } finally {
      setIsTyping(false);
      setSearchingFor(null);
    }
  }, [input, isTyping, messages, state, session, firstName]);

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
      <div className="p-4 border-t border-border glass">
        <div className="flex gap-2 max-w-2xl mx-auto items-end">
          <Textarea
            placeholder="Ask about training, nutrition, food therapy, or health awareness..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
            className="resize-none min-h-[42px] max-h-32 text-sm"
            style={{ height: 'auto' }}
          />
          <Button
            onClick={startVoice}
            size="icon"
            variant={isListening ? 'destructive' : 'outline'}
            className="shrink-0 h-[42px] w-[42px]"
            title={isListening ? 'Stop listening' : 'Speak to Ovia'}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </Button>
          <Button
            onClick={() => handleSend()}
            disabled={!input.trim() || isTyping}
            size="icon"
            className="shrink-0 h-[42px] w-[42px]"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-2">
          Ovia AI is for fitness, food therapy &amp; health awareness only. It does not replace any doctor, dietitian, or healthcare professional. Always consult a qualified professional for medical decisions. You are solely responsible for any action you take based on this app.
        </p>
      </div>
    </div>
  );
}
