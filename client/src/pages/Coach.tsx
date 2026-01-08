import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'wouter';
import { ChevronLeft, Send, Bot, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
}

const getCoachResponse = (input: string, state: AppState): string => {
  const lowerInput = input.toLowerCase();
  const goals = state.user?.goals || [];
  const streak = state.streak;
  const recentWorkouts = state.workoutLogs.slice(0, 3);

  if (lowerInput.includes('hello') || lowerInput.includes('hi') || lowerInput.includes('hey')) {
    return `Hey ${state.user?.name?.split(' ')[0] || 'there'}! 💪 Great to see you. You're on a ${streak}-day streak - keep it up! What can I help you with today?`;
  }

  if (lowerInput.includes('workout') && lowerInput.includes('today')) {
    if (recentWorkouts.length > 0 && recentWorkouts[0].date === new Date().toISOString().split('T')[0]) {
      return `You already crushed a workout today! ${recentWorkouts[0].workoutName} - great job burning ${recentWorkouts[0].caloriesBurned} calories. Rest is important too, but if you're feeling energetic, a light mobility session could help with recovery.`;
    }
    return `Looking to train today? Based on your goals, I'd recommend a strength session. Check out the "Full Body Strength" workout in the library - it's perfect for ${goals.includes('muscle_gain') ? 'building muscle' : 'getting stronger'}.`;
  }

  if (lowerInput.includes('lose') && (lowerInput.includes('weight') || lowerInput.includes('fat'))) {
    return `For fat loss, focus on these key areas:\n\n1. **Caloric deficit** - Track your meals in the Nutrition tab\n2. **HIIT workouts** - Try our "HIIT Cardio Blast" 2-3x per week\n3. **Strength training** - Maintains muscle while losing fat\n4. **Consistency** - Your ${streak}-day streak shows you've got this!\n\nWant me to suggest a specific workout plan?`;
  }

  if (lowerInput.includes('build') && lowerInput.includes('muscle')) {
    return `To build muscle effectively:\n\n1. **Progressive overload** - Gradually increase weights\n2. **Protein intake** - Aim for 0.8-1g per lb of bodyweight\n3. **Recovery** - Sleep 7-9 hours and rest between sessions\n4. **Compound lifts** - Focus on squats, deadlifts, bench, rows\n\nCheck out the "8-Week Hypertrophy" program - it's designed exactly for this goal!`;
  }

  if (lowerInput.includes('sore') || lowerInput.includes('recovery')) {
    return `Muscle soreness is normal! Here's how to recover faster:\n\n1. **Active recovery** - Light walking or yoga\n2. **Hydration** - Drink plenty of water\n3. **Sleep** - This is when muscles actually grow\n4. **Nutrition** - Protein and anti-inflammatory foods\n\nTry the "Mobility & Recovery" workout - it's specifically designed to help with this.`;
  }

  if (lowerInput.includes('motivation') || lowerInput.includes('motivated')) {
    return `I get it - we all have those days! Remember:\n\n✨ You're on a ${streak}-day streak - don't break it!\n✨ Progress isn't always visible, but it's happening\n✨ Even a 10-minute workout counts\n✨ You chose to message me - that's already a step forward\n\nHow about starting with just a quick warmup? Movement creates momentum!`;
  }

  if (lowerInput.includes('protein') || lowerInput.includes('nutrition') || lowerInput.includes('eat')) {
    const proteinGoal = Math.round((state.user?.weight || 150) * 0.8);
    return `Great question about nutrition! For your goals:\n\n**Protein**: Aim for ${proteinGoal}g daily (about 0.8g per lb)\n**Timing**: Spread it across 4-5 meals\n**Sources**: Chicken, fish, eggs, Greek yogurt, legumes\n\nUse the Nutrition tab to track your macros. Need specific meal ideas?`;
  }

  if (lowerInput.includes('rest') || lowerInput.includes('rest day')) {
    return `Rest days are crucial for progress! Your muscles grow during rest, not during workouts. On rest days:\n\n• Light walking or stretching is fine\n• Focus on sleep quality\n• Meal prep for the week\n• Foam rolling or massage\n\nDon't feel guilty - rest IS part of training!`;
  }

  if (lowerInput.includes('help') || lowerInput.includes('what can you')) {
    return `I'm your AI coach! I can help with:\n\n💪 Workout recommendations\n🍎 Nutrition guidance\n🎯 Goal-setting advice\n😴 Recovery tips\n🔥 Motivation when you need it\n📊 Interpreting your progress\n\nJust ask me anything fitness-related!`;
  }

  const responses = [
    `That's a great question! Based on your ${goals.length > 0 ? goals.join(' and ') + ' goals' : 'fitness journey'}, I'd recommend staying consistent with your workouts and focusing on progressive overload.`,
    `Keep pushing! You're doing amazing with your ${streak}-day streak. Remember, consistency beats perfection every time.`,
    `I'd suggest checking out your scheduled workouts for this week and making sure you're hitting your protein targets. Small wins add up!`,
  ];

  return responses[Math.floor(Math.random() * responses.length)];
};

export function Coach({ state }: CoachProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'coach',
      content: `Hey ${state.user?.name?.split(' ')[0] || 'there'}! 👋 I'm your AI fitness coach. I'm here to help you with workout recommendations, nutrition advice, motivation, and anything else on your fitness journey. What's on your mind?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

    const coachResponse: Message = {
      id: crypto.randomUUID(),
      role: 'coach',
      content: getCoachResponse(input, state),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, coachResponse]);
    setIsTyping(false);
  };

  const suggestions = [
    'What should I eat today?',
    'I need motivation',
    'How do I build muscle?',
    'What workout should I do?',
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ChevronLeft className="w-6 h-6" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold">AI Coach</h1>
              <p className="text-xs text-muted-foreground">Always here to help</p>
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="max-w-lg mx-auto space-y-4">
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'flex gap-3',
                message.role === 'user' && 'flex-row-reverse'
              )}
            >
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                message.role === 'coach' ? 'bg-primary/20' : 'bg-muted'
              )}>
                {message.role === 'coach' ? (
                  <Bot className="w-4 h-4 text-primary" />
                ) : (
                  <User className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
              <Card className={cn(
                'p-3 max-w-[80%]',
                message.role === 'user' && 'bg-primary text-primary-foreground'
              )}>
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </Card>
            </motion.div>
          ))}

          {isTyping && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-3"
            >
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <Card className="p-3">
                <div className="flex gap-1">
                  <motion.div
                    className="w-2 h-2 rounded-full bg-muted-foreground"
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                  />
                  <motion.div
                    className="w-2 h-2 rounded-full bg-muted-foreground"
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                  />
                  <motion.div
                    className="w-2 h-2 rounded-full bg-muted-foreground"
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                  />
                </div>
              </Card>
            </motion.div>
          )}

          {messages.length === 1 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {suggestions.map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  onClick={() => setInput(suggestion)}
                  data-testid={`suggestion-${suggestion.replace(/\s+/g, '-').toLowerCase()}`}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-border">
        <div className="flex gap-2 max-w-lg mx-auto">
          <Input
            placeholder="Ask your coach..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            data-testid="input-message"
          />
          <Button onClick={handleSend} disabled={!input.trim() || isTyping} data-testid="button-send">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}