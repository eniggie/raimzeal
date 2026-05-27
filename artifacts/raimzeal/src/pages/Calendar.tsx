import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus, Check, Dumbbell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { BottomNav } from '@/components/BottomNav';
import { cn } from '@/lib/utils';
import { workouts, type ScheduledWorkout, type AppState } from '@/lib/store';

interface CalendarProps {
  state: AppState;
  onScheduleWorkout: (workout: ScheduledWorkout) => void;
}

export function Calendar({ state, onScheduleWorkout }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const startOfWeek = new Date(currentDate);
  startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(startOfWeek);
    day.setDate(startOfWeek.getDate() + i);
    return day;
  });

  const today = new Date().toISOString().split('T')[0];

  const getWorkoutsForDate = (dateStr: string) => {
    return (state.scheduledWorkouts ?? []).filter(s => s.date === dateStr);
  };

  const handleSchedule = (workoutId: string) => {
    if (!selectedDate) return;
    
    const workout = workouts.find(w => w.id === workoutId);
    if (!workout) return;

    const scheduled: ScheduledWorkout = {
      id: crypto.randomUUID(),
      workoutId: workout.id,
      workoutName: workout.name,
      date: selectedDate,
      completed: false,
    };
    onScheduleWorkout(scheduled);
    setIsDialogOpen(false);
  };

  const navigateWeek = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + direction * 7);
    setCurrentDate(newDate);
  };

  return (
    <div className="min-h-screen bg-background pb-nav">
      <div className="px-4 pt-6 pb-4 space-y-6 max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <h1 className="text-2xl font-bold font-display">Schedule</h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigateWeek(-1)} data-testid="button-prev-week">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <span className="text-sm font-medium min-w-[100px] text-center">
              {currentDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </span>
            <Button variant="ghost" size="icon" onClick={() => navigateWeek(1)} data-testid="button-next-week">
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-7 gap-1"
        >
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="text-center text-xs text-muted-foreground py-2">
              {day}
            </div>
          ))}
          {weekDays.map((day, i) => {
            const dateStr = day.toISOString().split('T')[0];
            const dayWorkouts = getWorkoutsForDate(dateStr);
            const isToday = dateStr === today;
            const isSelected = dateStr === selectedDate;
            const hasWorkout = dayWorkouts.length > 0;
            const allCompleted = dayWorkouts.every(w => w.completed);

            return (
              <motion.button
                key={i}
                onClick={() => setSelectedDate(dateStr)}
                className={cn(
                  'relative p-2 rounded-xl flex flex-col items-center gap-1 transition-colors',
                  isToday && 'bg-primary/10',
                  isSelected && 'ring-2 ring-primary',
                  !isToday && !isSelected && 'hover:bg-muted/50'
                )}
                whileTap={{ scale: 0.95 }}
                data-testid={`day-${dateStr}`}
              >
                <span className={cn(
                  'text-lg font-medium',
                  isToday && 'text-primary'
                )}>
                  {day.getDate()}
                </span>
                {hasWorkout && (
                  <div className={cn(
                    'w-2 h-2 rounded-full',
                    allCompleted ? 'bg-success' : 'bg-primary'
                  )} />
                )}
              </motion.button>
            );
          })}
        </motion.div>

        {selectedDate && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric'
                })}
              </h2>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-add-workout">
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Schedule Workout</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2 pt-4">
                    {workouts.map((workout) => (
                      <Card
                        key={workout.id}
                        className="p-3 cursor-pointer hover:border-primary/30 transition-colors"
                        onClick={() => handleSchedule(workout.id)}
                        data-testid={`schedule-workout-${workout.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Dumbbell className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{workout.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {workout.duration} min · {workout.category}
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {getWorkoutsForDate(selectedDate).length > 0 ? (
              <div className="space-y-2">
                {getWorkoutsForDate(selectedDate).map((scheduled, i) => (
                  <Card key={scheduled.id} className="p-3" data-testid={`scheduled-${i}`}>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center',
                        scheduled.completed ? 'bg-success/10' : 'bg-primary/10'
                      )}>
                        {scheduled.completed ? (
                          <Check className="w-5 h-5 text-success" />
                        ) : (
                          <Dumbbell className="w-5 h-5 text-primary" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{scheduled.workoutName}</div>
                        <div className="text-sm text-muted-foreground">
                          {scheduled.completed ? 'Completed' : 'Scheduled'}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-6 text-center text-muted-foreground">
                <Dumbbell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No workouts scheduled</p>
                <p className="text-sm">Tap + to add one</p>
              </Card>
            )}
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="p-4 bg-primary/5 border-primary/20">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                <Dumbbell className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">Workout Reminder</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Notifications will remind you 30 minutes before scheduled workouts.
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
      <BottomNav />
    </div>
  );
}