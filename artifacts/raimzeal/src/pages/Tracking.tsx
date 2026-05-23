import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'wouter';
import { 
  TrendingUp, TrendingDown, Scale, Ruler, Camera, 
  Plus, Trophy, Dumbbell, ChevronRight, Share2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BottomNav } from '@/components/BottomNav';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import type { AppState, BodyMeasurement } from '@/lib/store';
import { ProgressShareCard } from '@/components/ProgressShareCard';

interface TrackingProps {
  state: AppState;
  onAddMeasurement: (measurement: BodyMeasurement) => void;
}

export function Tracking({ state, onAddMeasurement }: TrackingProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [bodyMeasOpen, setBodyMeasOpen] = useState(false);
  const [measFields, setMeasFields] = useState({
    weight: '', chest: '', waist: '', hips: '', arms: '', thighs: '',
  });

  const handleSaveBodyMeasurements = () => {
    const weight = parseFloat(measFields.weight);
    if (isNaN(weight) || weight <= 0) return;
    const measurement: BodyMeasurement = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().split('T')[0],
      weight,
      ...(measFields.chest ? { chest: parseFloat(measFields.chest) } : {}),
      ...(measFields.waist ? { waist: parseFloat(measFields.waist) } : {}),
      ...(measFields.hips ? { hips: parseFloat(measFields.hips) } : {}),
      ...(measFields.arms ? { arms: parseFloat(measFields.arms) } : {}),
      ...(measFields.thighs ? { thighs: parseFloat(measFields.thighs) } : {}),
    };
    onAddMeasurement(measurement);
    setMeasFields({ weight: '', chest: '', waist: '', hips: '', arms: '', thighs: '' });
    setBodyMeasOpen(false);
  };

  const weightData = state.bodyMeasurements
    .slice(0, 8)
    .reverse()
    .map(m => ({
      date: new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      weight: m.weight,
    }));

  const latestWeight = state.bodyMeasurements[0]?.weight || state.user?.weight || 0;
  const previousWeight = state.bodyMeasurements[1]?.weight || latestWeight;
  const weightChange = latestWeight - previousWeight;

  const workoutsThisWeek = state.workoutLogs.filter(log => {
    const logDate = new Date(log.date);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return logDate >= weekAgo;
  }).length;

  const totalCaloriesBurned = state.workoutLogs
    .slice(0, 7)
    .reduce((sum, log) => sum + log.caloriesBurned, 0);

  const handleAddWeight = () => {
    if (!newWeight) return;
    
    const measurement: BodyMeasurement = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().split('T')[0],
      weight: parseFloat(newWeight),
    };
    onAddMeasurement(measurement);
    setNewWeight('');
    setIsDialogOpen(false);
  };

  return (
    <div className="min-h-screen bg-background" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 7rem)' }}>
      <div className="px-4 pt-6 pb-4 space-y-6 max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <h1 className="text-2xl font-bold font-display">Progress</h1>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShareOpen(true)}
              data-testid="button-share"
            >
              <Share2 className="w-4 h-4 mr-1" />
              Share
            </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-log">
                <Plus className="w-4 h-4 mr-1" />
                Log
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Log Weight</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Weight ({state.user?.units === 'metric' ? 'kg' : 'lbs'})</Label>
                  <Input
                    type="number"
                    placeholder="Enter weight"
                    value={newWeight}
                    onChange={(e) => setNewWeight(e.target.value)}
                    data-testid="input-weight"
                  />
                </div>
                <Button onClick={handleAddWeight} className="w-full" data-testid="button-save">
                  Save
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 gap-3"
        >
          <Card className="p-4" data-testid="card-weight">
            <div className="flex items-center gap-2 mb-2">
              <Scale className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Current Weight</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{latestWeight}</span>
              <span className="text-sm text-muted-foreground">
                {state.user?.units === 'metric' ? 'kg' : 'lbs'}
              </span>
            </div>
            <div className={`flex items-center gap-1 text-sm mt-1 ${weightChange <= 0 ? 'text-success' : 'text-destructive'}`}>
              {weightChange <= 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
              {Math.abs(weightChange).toFixed(1)} lbs
            </div>
          </Card>

          <Card className="p-4" data-testid="card-workouts">
            <div className="flex items-center gap-2 mb-2">
              <Dumbbell className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">This Week</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{workoutsThisWeek}</span>
              <span className="text-sm text-muted-foreground">workouts</span>
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {totalCaloriesBurned} cal burned
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Tabs defaultValue="weight" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="weight" className="flex-1">Weight</TabsTrigger>
              <TabsTrigger value="workouts" className="flex-1">Workouts</TabsTrigger>
              <TabsTrigger value="prs" className="flex-1">PRs</TabsTrigger>
            </TabsList>

            <TabsContent value="weight" className="mt-4">
              <Card className="p-4">
                <h3 className="font-semibold mb-4">Weight Trend</h3>
                {weightData.length > 1 ? (
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={weightData}>
                        <defs>
                          <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis 
                          dataKey="date" 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <YAxis 
                          domain={['dataMin - 2', 'dataMax + 2']}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="weight"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          fill="url(#weightGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-48 flex items-center justify-center text-muted-foreground">
                    <p>Log more weights to see your trend</p>
                  </div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="workouts" className="mt-4 space-y-3">
              {state.workoutLogs.slice(0, 10).map((log, i) => (
                <Card key={log.id} className="p-3" data-testid={`card-workout-log-${i}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Dumbbell className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{log.workoutName}</div>
                      <div className="text-sm text-muted-foreground">
                        {log.duration} min · {log.caloriesBurned} cal
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(log.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                </Card>
              ))}
              {state.workoutLogs.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Dumbbell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No workouts logged yet</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="prs" className="mt-4 space-y-3">
              {state.personalRecords.map((pr, i) => (
                <Card key={i} className="p-3" data-testid={`card-pr-${i}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                      <Trophy className="w-5 h-5 text-warning" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{pr.exercise}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(pr.date).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-xl font-bold text-primary">{pr.weight} lbs</div>
                  </div>
                </Card>
              ))}
              {state.personalRecords.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No personal records yet</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Link href="/progress/photos">
            <Card className="p-4 cursor-pointer hover:border-primary/30 glass-hover" data-testid="card-photos">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
                  <Camera className="w-6 h-6 text-accent" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold">Progress Photos</div>
                  <div className="text-sm text-muted-foreground">Track your visual transformation</div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </Card>
          </Link>

          <Card
            className="p-4 mt-3 cursor-pointer hover:border-primary/30 glass-hover"
            data-testid="card-measurements"
            onClick={() => setBodyMeasOpen(true)}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center">
                <Ruler className="w-6 h-6 text-secondary" />
              </div>
              <div className="flex-1">
                <div className="font-semibold">Body Measurements</div>
                <div className="text-sm text-muted-foreground">Chest, waist, arms, and more</div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Body Measurements Dialog */}
      <Dialog open={bodyMeasOpen} onOpenChange={setBodyMeasOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log Body Measurements</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-xs text-muted-foreground">Weight is required. All other measurements are optional.</p>
            {([
              { key: 'weight', label: `Weight (${state.user?.units === 'metric' ? 'kg' : 'lbs'})`, required: true },
              { key: 'chest', label: 'Chest (in)', required: false },
              { key: 'waist', label: 'Waist (in)', required: false },
              { key: 'hips', label: 'Hips (in)', required: false },
              { key: 'arms', label: 'Arms (in)', required: false },
              { key: 'thighs', label: 'Thighs (in)', required: false },
            ] as const).map(({ key, label, required }) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs">
                  {label}
                  {required && <span className="text-destructive ml-1">*</span>}
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="—"
                  value={measFields[key]}
                  onChange={e => setMeasFields(prev => ({ ...prev, [key]: e.target.value }))}
                />
              </div>
            ))}
            <Button
              onClick={handleSaveBodyMeasurements}
              disabled={!measFields.weight || isNaN(parseFloat(measFields.weight))}
              className="w-full mt-2"
            >
              Save Measurements
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav />
      <ProgressShareCard open={shareOpen} onClose={() => setShareOpen(false)} state={state} />
    </div>
  );
}