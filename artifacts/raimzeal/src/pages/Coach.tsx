import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'wouter';
import { ChevronLeft, Send, Bot, User, Globe, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { AppState } from '@/lib/store';

interface CoachProps {
  state: AppState;
}

interface Message {
  id: string;
  role: 'user' | 'coach';
  content: string;
  timestamp: Date;
  searching?: string;
}

function buildUserContext(state: AppState) {
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
    age: state.user?.age ?? null,
    fitnessLevel: state.user?.fitnessLevel ?? 'intermediate',
    streak: state.streak,
    recentWorkouts,
  };
}

const SUGGESTIONS = [
  'What should I eat today to hit my goals?',
  'Design me a workout for this week',
  'How do I build muscle faster?',
  'I need motivation right now',
  'Best supplements for my goals?',
  'How do I improve my recovery?',
];

export function Coach({ state }: CoachProps) {
  const firstName = state.user?.name?.split(' ')[0] ?? 'Champion';

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'coach',
      content: `Welcome back, ${firstName}! I am Ovia AI, your dedicated fitness coach, nutritionist, and mindset mentor. You are on a ${state.streak}-day streak and that is something to be genuinely proud of.\n\nI have full access to your profile, your training history, and your goals. I am here to give you real, science-backed guidance every single time you ask.\n\nWhat can I help you with today?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [searchingFor, setSearchingFor] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    const trimmed = input.trim();
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

    try {
      const allMessages = [...messages, userMessage].map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      }));

      const response = await fetch('/api/ovia/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: allMessages,
          userContext: buildUserContext(state),
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) throw new Error('API error');

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
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

            if (json.searching) {
              setSearchingFor(json.searching);
            }

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
              setIsTyping(false);
              setSearchingFor(null);
            }
          } catch {
            // skip malformed chunk
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content:
                  'I am having trouble connecting right now. Please check your connection and try again.',
              }
            : m
        )
      );
    } finally {
      setIsTyping(false);
      setSearchingFor(null);
    }
  };

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
              <div className="w-10 h-10 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-accent" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-primary rounded-full border-2 border-background" />
            </div>
            <div>
              <h1 className="font-semibold text-sm">Ovia AI</h1>
              <p className="text-xs text-primary">Online — fitness and health expert</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Globe className="w-3 h-3" />
            <span>Web search enabled</span>
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
                    ? 'bg-accent/20 border border-accent/30'
                    : 'bg-primary/20 border border-primary/30'
                )}
              >
                {message.role === 'coach' ? (
                  <Sparkles className="w-4 h-4 text-accent" />
                ) : (
                  <User className="w-4 h-4 text-primary" />
                )}
              </div>
              <Card
                className={cn(
                  'p-3 max-w-[82%] shadow-none',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground border-primary/50'
                    : 'glass'
                )}
              >
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
          {messages.length === 1 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {SUGGESTIONS.map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  onClick={() => setInput(suggestion)}
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
            placeholder="Ask Ovia anything about your fitness and health..."
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
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            size="icon"
            className="shrink-0 h-[42px] w-[42px]"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-2">
          Ovia AI focuses on fitness and healthcare only. Always consult a doctor for medical decisions.
        </p>
      </div>
    </div>
  );
}
