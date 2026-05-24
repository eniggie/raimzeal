import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'wouter';
import { ChevronLeft, ChevronRight, Clock, Target, Dumbbell, CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { programs } from '@/lib/store';
import { BottomNav } from '@/components/BottomNav';

const difficultyColors: Record<string, string> = {
  beginner: 'bg-success/20 text-success',
  intermediate: 'bg-warning/20 text-warning',
  advanced: 'bg-destructive/20 text-destructive',
};

const goalColors: Record<string, string> = {
  'Build base fitness': 'from-success/20 to-success/5',
  'Build muscle mass': 'from-primary/20 to-primary/5',
  'Lose fat, maintain muscle': 'from-destructive/20 to-destructive/5',
  'Improve flexibility': 'from-secondary/20 to-secondary/5',
};

type ProgramId = (typeof programs)[number]['id'];

export function Programs() {
  const [enrolledIds, setEnrolledIds] = useState<Set<ProgramId>>(new Set());
  const [confirmedId, setConfirmedId] = useState<ProgramId | null>(null);

  function handleStart(id: ProgramId, name: string) {
    setEnrolledIds((prev) => new Set([...prev, id]));
    setConfirmedId(id);
    setTimeout(() => setConfirmedId(null), 3000);
  }

  function handleUnenroll(id: ProgramId) {
    setEnrolledIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-background pb-nav">
      <div className="px-4 pt-6 pb-4 space-y-6 max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ChevronLeft className="w-6 h-6" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold font-display">Programs</h1>
            <p className="text-sm text-muted-foreground">Guided workout plans</p>
          </div>
        </motion.div>

        {/* Success banner */}
        <AnimatePresence>
          {confirmedId && (
            <motion.div
              key="banner"
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.25 }}
              className="flex items-center gap-3 p-3 rounded-xl bg-success/10 border border-success/30"
            >
              <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-success">Program started!</p>
                <p className="text-xs text-muted-foreground truncate">
                  {programs.find((p) => p.id === confirmedId)?.name} — check your Workouts tab to begin.
                </p>
              </div>
              <button
                onClick={() => setConfirmedId(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {enrolledIds.size > 0 && (
          <div className="text-xs text-muted-foreground px-1">
            {enrolledIds.size} program{enrolledIds.size > 1 ? 's' : ''} active — tap a card to manage
          </div>
        )}

        <div className="space-y-4">
          {programs.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-sm font-medium">No programs available</p>
              <p className="text-xs mt-1">Check back soon — new programs are added regularly.</p>
            </div>
          )}
          {programs.map((program, i) => {
            const enrolled = enrolledIds.has(program.id);
            return (
              <motion.div
                key={program.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card
                  className={`overflow-hidden cursor-pointer group transition-colors ${enrolled ? 'border-primary/40 bg-primary/5' : 'hover:border-primary/30'}`}
                  data-testid={`card-program-${program.id}`}
                >
                  <div className={`relative h-28 bg-gradient-to-br ${goalColors[program.goal] || 'from-muted/40 to-muted/10'}`}>
                    <div className="absolute inset-0 p-4 flex flex-col justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={difficultyColors[program.difficulty]}>
                          {program.difficulty}
                        </Badge>
                        {enrolled && (
                          <Badge className="bg-primary/20 text-primary border-0">
                            Active
                          </Badge>
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold font-display text-lg group-hover:text-primary transition-colors">
                          {program.name}
                        </h3>
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    <p className="text-sm text-muted-foreground mb-4">{program.description}</p>

                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        {program.duration}
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Target className="w-4 h-4" />
                        {program.goal}
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Dumbbell className="w-4 h-4 text-primary" />
                          <span className="text-sm">
                            {program.weeks.length} weeks · {program.weeks.reduce((sum, w) => sum + w.workouts.length, 0)} workouts
                          </span>
                        </div>
                        {enrolled ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-success flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Started
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 px-2 text-xs"
                              onClick={() => handleUnenroll(program.id)}
                            >
                              Drop
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            className="glow-sm"
                            onClick={() => handleStart(program.id, program.name)}
                          >
                            Start
                            <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="p-4 bg-primary/5 border-primary/20">
            <h3 className="font-semibold mb-2">How Programs Work</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-medium text-primary">1</span>
                </div>
                <span>Choose a program based on your goals</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-medium text-primary">2</span>
                </div>
                <span>Follow the weekly schedule with rest days</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-medium text-primary">3</span>
                </div>
                <span>Track progress and see results over time</span>
              </li>
            </ul>
          </Card>
        </motion.div>
      </div>
      <BottomNav />
    </div>
  );
}
