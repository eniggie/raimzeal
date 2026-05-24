import { useState } from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { ChevronLeft, Calculator, Scale, Flame, Beef, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BottomNav } from '@/components/BottomNav';
import { cn } from '@/lib/utils';

function bmiCategory(bmi: number) {
  if (bmi < 18.5) return { label: 'Underweight', color: 'text-blue-400' };
  if (bmi < 25) return { label: 'Normal weight', color: 'text-green-400' };
  if (bmi < 30) return { label: 'Overweight', color: 'text-yellow-400' };
  return { label: 'Obese', color: 'text-destructive' };
}

function calcBMR(weight: number, height: number, age: number, sex: 'male' | 'female') {
  if (sex === 'male') return 10 * weight + 6.25 * height - 5 * age + 5;
  return 10 * weight + 6.25 * height - 5 * age - 161;
}

const activityLevels = [
  { id: 'sedentary', label: 'Sedentary', desc: 'Little or no exercise', factor: 1.2 },
  { id: 'light', label: 'Light', desc: '1–3 days/week', factor: 1.375 },
  { id: 'moderate', label: 'Moderate', desc: '3–5 days/week', factor: 1.55 },
  { id: 'active', label: 'Active', desc: '6–7 days/week', factor: 1.725 },
  { id: 'very', label: 'Very Active', desc: 'Hard daily exercise', factor: 1.9 },
];

const goals = [
  { id: 'cut', label: 'Lose Fat', factor: -500, protein: 2.2, carbs: 0.22, fat: 0.25 },
  { id: 'maintain', label: 'Maintain', factor: 0, protein: 1.8, carbs: 0.30, fat: 0.25 },
  { id: 'bulk', label: 'Build Muscle', factor: 300, protein: 2.0, carbs: 0.40, fat: 0.25 },
];

export function Calculators() {
  // BMI
  const [bmiWeight, setBmiWeight] = useState('');
  const [bmiHeight, setBmiHeight] = useState('');
  const [bmiUnit, setBmiUnit] = useState<'metric' | 'imperial'>('metric');
  const [bmiResult, setBmiResult] = useState<number | null>(null);

  // TDEE
  const [tdeeWeight, setTdeeWeight] = useState('');
  const [tdeeHeight, setTdeeHeight] = useState('');
  const [tdeeAge, setTdeeAge] = useState('');
  const [tdeeSex, setTdeeSex] = useState<'male' | 'female'>('male');
  const [tdeeActivity, setTdeeActivity] = useState('moderate');
  const [tdeeGoal, setTdeeGoal] = useState('maintain');
  const [tdeeResult, setTdeeResult] = useState<{ tdee: number; target: number; protein: number; carbs: number; fat: number } | null>(null);

  function calcBMI() {
    const w = parseFloat(bmiWeight);
    const h = parseFloat(bmiHeight);
    if (!w || !h) return;
    let bmi: number;
    if (bmiUnit === 'metric') {
      bmi = w / ((h / 100) ** 2);
    } else {
      bmi = (703 * w) / (h ** 2);
    }
    setBmiResult(Math.round(bmi * 10) / 10);
  }

  function calcTDEE() {
    const w = parseFloat(tdeeWeight);
    const h = parseFloat(tdeeHeight);
    const a = parseFloat(tdeeAge);
    if (!w || !h || !a) return;
    const bmr = calcBMR(w, h, a, tdeeSex);
    const activity = activityLevels.find(l => l.id === tdeeActivity)!;
    const goal = goals.find(g => g.id === tdeeGoal)!;
    const tdee = Math.round(bmr * activity.factor);
    const target = tdee + goal.factor;
    const protein = Math.round(w * goal.protein);
    const fat = Math.round((target * goal.fat) / 9);
    const carbs = Math.round((target - protein * 4 - fat * 9) / 4);
    setTdeeResult({ tdee, target, protein, carbs: Math.max(carbs, 50), fat });
  }

  const bmiCat = bmiResult ? bmiCategory(bmiResult) : null;

  return (
    <div className="min-h-screen bg-background pb-nav">
      <div className="px-4 pt-6 pb-4 space-y-5 max-w-lg mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <Link href="/settings">
            <Button variant="ghost" size="icon"><ChevronLeft className="w-6 h-6" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold font-display flex items-center gap-2"><Calculator className="w-6 h-6 text-primary" />Calculators</h1>
            <p className="text-xs text-muted-foreground">BMI · TDEE · Macro Split</p>
          </div>
        </motion.div>

        <Tabs defaultValue="bmi">
          <TabsList className="w-full">
            <TabsTrigger value="bmi" className="flex-1">BMI</TabsTrigger>
            <TabsTrigger value="tdee" className="flex-1">TDEE + Macros</TabsTrigger>
          </TabsList>

          {/* BMI Calculator */}
          <TabsContent value="bmi" className="space-y-4 mt-4">
            <Card className="p-4 space-y-4">
              <div className="flex gap-2">
                {(['metric', 'imperial'] as const).map(u => (
                  <button
                    key={u}
                    onClick={() => { setBmiUnit(u); setBmiResult(null); }}
                    className={cn('flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors', bmiUnit === u ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}
                  >
                    {u === 'metric' ? 'Metric (kg/cm)' : 'Imperial (lb/in)'}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs mb-1 block">Weight ({bmiUnit === 'metric' ? 'kg' : 'lbs'})</Label>
                  <Input type="number" placeholder={bmiUnit === 'metric' ? '70' : '154'} value={bmiWeight} onChange={e => setBmiWeight(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Height ({bmiUnit === 'metric' ? 'cm' : 'inches'})</Label>
                  <Input type="number" placeholder={bmiUnit === 'metric' ? '175' : '69'} value={bmiHeight} onChange={e => setBmiHeight(e.target.value)} />
                </div>
              </div>

              <Button className="w-full glow-sm" onClick={calcBMI}><Scale className="w-4 h-4 mr-2" />Calculate BMI</Button>
            </Card>

            {bmiResult && bmiCat && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="p-5 text-center space-y-2">
                  <p className="text-muted-foreground text-sm">Your BMI</p>
                  <p className="text-5xl font-bold text-primary">{bmiResult}</p>
                  <p className={cn('text-lg font-semibold', bmiCat.color)}>{bmiCat.label}</p>

                  <div className="relative h-3 rounded-full overflow-hidden mt-3 bg-gradient-to-r from-blue-500 via-green-500 via-yellow-500 to-red-500">
                    <div
                      className="absolute top-0 h-full w-1 bg-white rounded-full shadow-lg transition-all"
                      style={{ left: `${Math.min(Math.max(((bmiResult - 15) / 25) * 100, 0), 100)}%`, transform: 'translateX(-50%)' }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>15</span><span>18.5</span><span>25</span><span>30</span><span>40</span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mt-3 text-xs">
                    {[
                      { range: '< 18.5', label: 'Under', color: 'text-blue-400' },
                      { range: '18.5–24.9', label: 'Normal', color: 'text-green-400' },
                      { range: '25–29.9', label: 'Over', color: 'text-yellow-400' },
                      { range: '≥ 30', label: 'Obese', color: 'text-destructive' },
                    ].map(c => (
                      <div key={c.label} className="text-center">
                        <p className={cn('font-semibold', c.color)}>{c.label}</p>
                        <p className="text-muted-foreground">{c.range}</p>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    BMI is a screening tool, not a diagnosis. Muscle mass, bone density, and body composition affect results.
                  </p>
                </Card>
              </motion.div>
            )}
          </TabsContent>

          {/* TDEE + Macros Calculator */}
          <TabsContent value="tdee" className="space-y-4 mt-4">
            <Card className="p-4 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs mb-1 block">Weight (kg)</Label>
                  <Input type="number" placeholder="70" value={tdeeWeight} onChange={e => setTdeeWeight(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Height (cm)</Label>
                  <Input type="number" placeholder="175" value={tdeeHeight} onChange={e => setTdeeHeight(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Age</Label>
                  <Input type="number" placeholder="30" value={tdeeAge} onChange={e => setTdeeAge(e.target.value)} />
                </div>
              </div>

              <div>
                <Label className="text-xs mb-2 block">Biological Sex</Label>
                <div className="flex gap-2">
                  {(['male', 'female'] as const).map(s => (
                    <button key={s} onClick={() => setTdeeSex(s)} className={cn('flex-1 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors', tdeeSex === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>{s}</button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs mb-2 block">Activity Level</Label>
                <div className="space-y-1.5">
                  {activityLevels.map(l => (
                    <button key={l.id} onClick={() => setTdeeActivity(l.id)} className={cn('w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors border', tdeeActivity === l.id ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border bg-muted/30 text-foreground')}>
                      <span className="font-medium">{l.label}</span>
                      <span className="text-xs text-muted-foreground">{l.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs mb-2 block">Goal</Label>
                <div className="flex gap-2">
                  {goals.map(g => (
                    <button key={g.id} onClick={() => setTdeeGoal(g.id)} className={cn('flex-1 py-2 rounded-xl text-xs font-medium transition-colors border', tdeeGoal === g.id ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border bg-muted/30 text-muted-foreground')}>{g.label}</button>
                  ))}
                </div>
              </div>

              <Button className="w-full glow-sm" onClick={calcTDEE}><Flame className="w-4 h-4 mr-2" />Calculate TDEE & Macros</Button>
            </Card>

            {tdeeResult && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                <Card className="p-4">
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="rounded-xl bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground">Maintenance (TDEE)</p>
                      <p className="text-2xl font-bold text-foreground">{tdeeResult.tdee}</p>
                      <p className="text-xs text-muted-foreground">calories/day</p>
                    </div>
                    <div className="rounded-xl bg-primary/10 p-3 border border-primary/20">
                      <p className="text-xs text-muted-foreground">Your Target</p>
                      <p className="text-2xl font-bold text-primary">{tdeeResult.target}</p>
                      <p className="text-xs text-muted-foreground">calories/day</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <p className="text-sm font-semibold mb-3 flex items-center gap-2"><Beef className="w-4 h-4 text-red-400" />Daily Macro Targets</p>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    {[
                      { label: 'Protein', value: tdeeResult.protein, unit: 'g', color: 'text-red-400', bg: 'bg-red-500/10' },
                      { label: 'Carbs', value: tdeeResult.carbs, unit: 'g', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
                      { label: 'Fat', value: tdeeResult.fat, unit: 'g', color: 'text-blue-400', bg: 'bg-blue-500/10' },
                    ].map(m => (
                      <div key={m.label} className={cn('rounded-xl p-3', m.bg)}>
                        <p className={cn('text-2xl font-bold', m.color)}>{m.value}{m.unit}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{m.label}</p>
                        <p className="text-xs text-muted-foreground">{m.label === 'Protein' ? m.value * 4 : m.label === 'Carbs' ? m.value * 4 : m.value * 9} kcal</p>
                      </div>
                    ))}
                  </div>
                </Card>

                <p className="text-xs text-muted-foreground text-center leading-relaxed px-2">
                  These are estimates based on the Mifflin-St Jeor equation. Consult a registered dietitian for personalised guidance.
                </p>
              </motion.div>
            )}
          </TabsContent>
        </Tabs>
      </div>
      <BottomNav />
    </div>
  );
}
