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
  const firstName = state.user?.name?.split(' ')[0] || 'there';

  if (lowerInput.includes('hello') || lowerInput.includes('hi') || lowerInput.includes('hey')) {
    return `Hey ${firstName}! Great to see you. You are on a ${streak}-day streak — keep it going! What can I help you with today?`;
  }

  if (lowerInput.includes('workout') && lowerInput.includes('today')) {
    if (recentWorkouts.length > 0 && recentWorkouts[0].date === new Date().toISOString().split('T')[0]) {
      return `You already crushed a workout today — ${recentWorkouts[0].workoutName}, burning ${recentWorkouts[0].caloriesBurned} calories. Well done! Rest is important too, but if you are still feeling energetic, a light mobility session will help with recovery.`;
    }
    return `Looking to train today? Based on your goals, I would recommend a strength session. Check out the "Full Body Strength" workout in the library — it is perfect for ${goals.includes('muscle_gain') ? 'building muscle' : 'getting stronger'}.`;
  }

  if (lowerInput.includes('lose') && (lowerInput.includes('weight') || lowerInput.includes('fat'))) {
    return `For fat loss, here is what actually moves the needle:\n\nFirst, a caloric deficit. Track your meals in the Nutrition tab so you can see the real numbers.\n\nSecond, HIIT workouts. The "HIIT Cardio Blast" 2 to 3 times per week will torch calories.\n\nThird, keep lifting. Strength training preserves muscle while you lose fat — that is what gives you the lean look, not just cardio.\n\nYour ${streak}-day streak tells me you have the discipline for this. Want me to suggest a weekly schedule?`;
  }

  if (lowerInput.includes('build') && lowerInput.includes('muscle')) {
    return `To build muscle effectively, focus on three things:\n\nProgressive overload — increase your weights gradually over time. Your body adapts fast.\n\nProtein intake — aim for around ${Math.round((state.user?.weight || 150) * 0.8)}g of protein per day based on your weight.\n\nRecovery — your muscles grow during rest, not during the workout. Sleep 7 to 9 hours.\n\nThe "8-Week Hypertrophy" program under Programs is built exactly around these principles. Worth starting there.`;
  }

  if (lowerInput.includes('sore') || lowerInput.includes('recovery')) {
    return `Soreness after training is normal — it means you challenged your body. Here is how to recover faster:\n\nLight movement actually helps. A walk or the "Mobility and Recovery" workout increases blood flow and clears soreness faster than full rest.\n\nHydration matters more than most people think. Drink water consistently throughout the day.\n\nGet enough protein today. That is the raw material your muscles use to rebuild.\n\nAnd sleep. Sleep is the most underrated recovery tool there is.`;
  }

  if (lowerInput.includes('motivation') || lowerInput.includes('motivated')) {
    return `I hear you — some days the motivation is just not there. That is completely normal.\n\nHere is the thing though: you are on a ${streak}-day streak. That did not happen because you felt motivated every single one of those days. It happened because you showed up anyway.\n\nStart with something small. Even a 10-minute walk counts. Movement creates momentum, and momentum brings the motivation back.\n\nYou have already built something real here. One tough day will not erase it.`;
  }

  if (lowerInput.includes('protein') || lowerInput.includes('nutrition') || lowerInput.includes('eat')) {
    const proteinGoal = Math.round((state.user?.weight || 150) * 0.8);
    return `Good question. For your goals, aim for around ${proteinGoal}g of protein per day.\n\nPractically, that looks like this:\n\nBreakfast: 2 to 3 eggs or Greek yogurt with oats — around 30g protein.\nLunch: Grilled chicken or tuna salad — around 40g protein.\nDinner: Salmon or lean beef with vegetables — around 40g protein.\nSnacks: Cottage cheese, almonds, or a protein shake to fill the gaps.\n\nUse the Nutrition tab to log your meals. Once you see the actual numbers, hitting your targets becomes a lot easier.`;
  }

  if (lowerInput.includes('rest') || lowerInput.includes('rest day')) {
    return `Rest days are not optional — they are when your muscles actually grow and repair. Training creates the stimulus; rest is where the adaptation happens.\n\nOn a rest day, stay lightly active. Walk, stretch, do some foam rolling. Eat enough protein. Get to bed at a decent time.\n\nDo not feel guilty for resting. The athletes who last the longest treat recovery as seriously as their training.`;
  }

  if (lowerInput.includes('help') || lowerInput.includes('what can you')) {
    return `I am Ovia, your personal fitness coach here at RAIMZEAL. Here is what I can help with:\n\nWorkout recommendations tailored to your goals and level\n\nNutrition guidance — what to eat, when, and how much\n\nMotivation when you need a push\n\nRecovery advice when you are sore or tired\n\nProgress questions — understanding what your numbers actually mean\n\nJust talk to me like you would a real coach. What is on your mind?`;
  }

  const responses = [
    `Good question. Based on your ${goals.length > 0 ? goals.join(' and ') + ' goals' : 'fitness journey'}, the most important thing right now is staying consistent. Small, daily actions compound into big results over time.`,
    `Keep going, ${firstName}. You are on a ${streak}-day streak — that kind of consistency is how real change happens. Make sure you are hitting your protein targets and getting enough sleep alongside your training.`,
    `Check your scheduled workouts for the week and make sure your nutrition is on track. Those two things, done consistently, will take you further than any single workout ever could.`,
  ];

  return responses[Math.floor(Math.random() * responses.length)];
};

export function Coach({ state }: CoachProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'coach',
      content: `Hey ${state.user?.name?.split(' ')[0] || 'there'}! I am Ovia, your personal fitness coach. I am here to help with workout recommendations, nutrition advice, motivation, and anything else on your fitness journey. What is on your mind?`,
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
              <h1 className="font-semibold">Ovia AI</h1>
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
