import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'wouter';
import { 
  ChevronLeft, Plus, Search, Scan, Utensils, 
  Beef, Wheat, Droplets, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatRing } from '@/components/StatRing';
import { cn } from '@/lib/utils';
import { quickFoods, type MealLog, type AppState } from '@/lib/store';

interface NutritionProps {
  state: AppState;
  onAddMeal: (meal: MealLog) => void;
}

export function Nutrition({ state, onAddMeal }: NutritionProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedMealType, setSelectedMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('breakfast');

  const today = new Date().toISOString().split('T')[0];
  const todayMeals = state.mealLogs.filter(m => m.date === today);
  
  const totals = todayMeals.reduce((acc, meal) => ({
    calories: acc.calories + meal.calories,
    protein: acc.protein + meal.protein,
    carbs: acc.carbs + meal.carbs,
    fat: acc.fat + meal.fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const user = state.user;
  const goals = (() => {
    if (!user?.weight || !user?.height || !user?.age) {
      return { calories: 2200, protein: 150, carbs: 250, fat: 70 };
    }
    const weightKg = user.units === 'imperial' ? user.weight * 0.453592 : user.weight;
    const heightCm = user.units === 'imperial' ? user.height * 2.54 : user.height;
    const bmr = 10 * weightKg + 6.25 * heightCm - 5 * user.age + 5;
    const tdee = Math.round(bmr * 1.55);
    const protein = Math.round(weightKg * 2.2);
    const fat = Math.round(tdee * 0.25 / 9);
    const carbs = Math.max(Math.round((tdee - protein * 4 - fat * 9) / 4), 0);
    return { calories: tdee, protein, carbs, fat };
  })();

  const filteredFoods = quickFoods.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddFood = (food: typeof quickFoods[0]) => {
    const meal: MealLog = {
      id: crypto.randomUUID(),
      date: today,
      name: food.name,
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      mealType: selectedMealType,
    };
    onAddMeal(meal);
    setIsDialogOpen(false);
    setSearch('');
  };

  const mealsByType = {
    breakfast: todayMeals.filter(m => m.mealType === 'breakfast'),
    lunch: todayMeals.filter(m => m.mealType === 'lunch'),
    dinner: todayMeals.filter(m => m.mealType === 'dinner'),
    snack: todayMeals.filter(m => m.mealType === 'snack'),
  };

  return (
    <div className="min-h-screen bg-background pb-8">
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
          <h1 className="text-2xl font-bold font-display">Nutrition</h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Daily Summary</h2>
              <span className="text-sm text-muted-foreground">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </span>
            </div>

            <div className="flex justify-center mb-6">
              <StatRing value={totals.calories} max={goals.calories} size={120} strokeWidth={8}>
                <div className="text-center">
                  <div className="text-2xl font-bold">{totals.calories}</div>
                  <div className="text-xs text-muted-foreground">/ {goals.calories}</div>
                </div>
              </StatRing>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Beef className="w-4 h-4 text-destructive" />
                  <span className="text-sm font-medium">Protein</span>
                </div>
                <Progress value={(totals.protein / goals.protein) * 100} className="h-2 mb-1" />
                <span className="text-xs text-muted-foreground">{totals.protein}g / {goals.protein}g</span>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Wheat className="w-4 h-4 text-warning" />
                  <span className="text-sm font-medium">Carbs</span>
                </div>
                <Progress value={(totals.carbs / goals.carbs) * 100} className="h-2 mb-1" />
                <span className="text-xs text-muted-foreground">{totals.carbs}g / {goals.carbs}g</span>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Droplets className="w-4 h-4 text-secondary" />
                  <span className="text-sm font-medium">Fat</span>
                </div>
                <Progress value={(totals.fat / goals.fat) * 100} className="h-2 mb-1" />
                <span className="text-xs text-muted-foreground">{totals.fat}g / {goals.fat}g</span>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex gap-2"
        >
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex-1 glow-sm" data-testid="button-add-food">
                <Plus className="w-4 h-4 mr-2" />
                Add Food
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>Add Food</DialogTitle>
              </DialogHeader>
              
              <Tabs value={selectedMealType} onValueChange={(v) => setSelectedMealType(v as any)} className="mt-2">
                <TabsList className="w-full">
                  <TabsTrigger value="breakfast" className="flex-1">Breakfast</TabsTrigger>
                  <TabsTrigger value="lunch" className="flex-1">Lunch</TabsTrigger>
                  <TabsTrigger value="dinner" className="flex-1">Dinner</TabsTrigger>
                  <TabsTrigger value="snack" className="flex-1">Snack</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search foods..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-food"
                />
              </div>

              <div className="flex-1 overflow-y-auto mt-4 space-y-2">
                {filteredFoods.map((food, i) => (
                  <Card
                    key={i}
                    className="p-3 cursor-pointer hover:border-primary/30 glass-hover"
                    onClick={() => handleAddFood(food)}
                    data-testid={`food-${i}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{food.name}</div>
                        <div className="text-sm text-muted-foreground">
                          P: {food.protein}g · C: {food.carbs}g · F: {food.fat}g
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-primary">{food.calories}</div>
                        <div className="text-xs text-muted-foreground">cal</div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </DialogContent>
          </Dialog>

          <Button variant="outline" className="px-4" data-testid="button-scan">
            <Scan className="w-4 h-4 mr-2" />
            Scan
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((mealType) => (
            <div key={mealType}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold capitalize">{mealType}</h3>
                <span className="text-sm text-muted-foreground">
                  {mealsByType[mealType].reduce((sum, m) => sum + m.calories, 0)} cal
                </span>
              </div>
              {mealsByType[mealType].length > 0 ? (
                <div className="space-y-2">
                  {mealsByType[mealType].map((meal, i) => (
                    <Card key={meal.id} className="p-3" data-testid={`meal-${mealType}-${i}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                            <Utensils className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="font-medium text-sm">{meal.name}</div>
                            <div className="text-xs text-muted-foreground">
                              P: {meal.protein}g · C: {meal.carbs}g · F: {meal.fat}g
                            </div>
                          </div>
                        </div>
                        <span className="font-medium">{meal.calories}</span>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="p-3 border-dashed">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
                    <Plus className="w-4 h-4" />
                    <span>Add {mealType}</span>
                  </div>
                </Card>
              )}
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}