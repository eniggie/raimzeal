import { useState } from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { ChevronLeft, ChefHat, Clock, Flame, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BottomNav } from '@/components/BottomNav';
import { cn } from '@/lib/utils';

type Recipe = {
  id: string;
  name: string;
  emoji: string;
  category: string;
  tags: string[];
  time: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servings: number;
  ingredients: string[];
  steps: string[];
  tip?: string;
};

const recipes: Recipe[] = [
  {
    id: '1', name: 'High-Protein Oats Bowl', emoji: '🥣', category: 'Breakfast',
    tags: ['High Protein', 'Low Fat', 'Quick'],
    time: 10, calories: 420, protein: 32, carbs: 52, fat: 9, servings: 1,
    ingredients: ['1 cup rolled oats', '1 scoop whey protein (vanilla)', '1 tbsp chia seeds', '1 banana (sliced)', '200ml unsweetened almond milk', '1 tsp honey', 'Handful of blueberries'],
    steps: ['Combine oats and almond milk in a bowl', 'Microwave for 2 minutes, stir halfway', 'Stir in protein powder until smooth', 'Top with banana, blueberries, chia seeds', 'Drizzle honey. Serve warm or refrigerate overnight.'],
    tip: 'Great for blood types A and O — modify by skipping banana if type B.'
  },
  {
    id: '2', name: 'Grilled Chicken & Veggie Bowl', emoji: '🍗', category: 'Lunch',
    tags: ['High Protein', 'Low Carb', 'Balanced'],
    time: 25, calories: 510, protein: 48, carbs: 28, fat: 18, servings: 1,
    ingredients: ['200g chicken breast', '1 cup brown rice (cooked)', '1 cup broccoli florets', '1 red bell pepper (sliced)', '2 tbsp olive oil', '1 tsp turmeric', '1 tsp garlic powder', 'Salt and pepper to taste', 'Lemon wedge'],
    steps: ['Season chicken with turmeric, garlic, salt and pepper', 'Grill or pan-fry chicken 6–7 minutes each side until cooked through', 'Stir-fry broccoli and pepper in olive oil for 5 minutes', 'Serve chicken over rice with veggies', 'Squeeze lemon juice over the top'],
    tip: 'Turmeric is an anti-inflammatory powerhouse — excellent for recovery after workouts.'
  },
  {
    id: '3', name: 'Blood Type–Friendly Salmon', emoji: '🐟', category: 'Dinner',
    tags: ['Omega-3', 'Anti-Inflammatory', 'Gluten-Free'],
    time: 20, calories: 480, protein: 42, carbs: 18, fat: 26, servings: 1,
    ingredients: ['180g salmon fillet', '1 cup spinach', '1/2 cup cherry tomatoes', '1 tbsp olive oil', '1 clove garlic (minced)', '1 tsp ginger (grated)', '1 tbsp soy sauce (low sodium)', 'Sesame seeds to garnish'],
    steps: ['Marinate salmon in soy sauce, garlic and ginger for 10 min', 'Pan-sear salmon skin-side down for 4 minutes, flip, cook 3 more minutes', 'In same pan, wilt spinach and tomatoes in olive oil for 2 min', 'Serve salmon over greens, garnish with sesame seeds'],
    tip: 'Highly beneficial for blood type O and B. Excellent source of EPA and DHA omega-3s for brain and heart health.'
  },
  {
    id: '4', name: 'Nigerian Egusi Soup (Healthy)', emoji: '🫕', category: 'Dinner',
    tags: ['Traditional', 'High Protein', 'Iron-Rich'],
    time: 45, calories: 520, protein: 36, carbs: 22, fat: 32, servings: 2,
    ingredients: ['1 cup egusi (melon seeds) — ground', '300g chicken or fish (lean)', '2 cups spinach or bitter leaf', '1 onion (chopped)', '2 tomatoes (blended)', '2 tbsp palm oil (reduced)', '2 stock cubes', 'Crayfish to taste', 'Salt and pepper'],
    steps: ['Fry egusi in palm oil on medium heat for 5 minutes until fragrant', 'Add blended tomatoes and onions, fry 10 minutes', 'Add stock cubes, crayfish and 1 cup water', 'Add protein, cook 15 minutes until tender', 'Stir in leafy greens, cook 5 more minutes', 'Serve with small portion of oat eba or brown swallow'],
    tip: 'Egusi is rich in healthy fats, vitamin E, and protein. Reduce palm oil for a leaner version.'
  },
  {
    id: '5', name: 'Green Power Smoothie', emoji: '🥤', category: 'Snack',
    tags: ['Alkaline', 'Detox', 'Low Calorie'],
    time: 5, calories: 220, protein: 8, carbs: 38, fat: 4, servings: 1,
    ingredients: ['1 cup baby spinach', '1/2 cucumber', '1 green apple (cored)', '1/2 banana (frozen)', '1 tbsp flaxseeds', '200ml coconut water', 'Juice of 1/2 lime', '1 tsp spirulina (optional)'],
    steps: ['Add all ingredients to blender', 'Blend on high for 60 seconds until smooth', 'Add more coconut water if too thick', 'Serve immediately for maximum nutrients'],
    tip: 'The alkaline blend of spinach and cucumber helps reduce inflammation. Best consumed in the morning.'
  },
  {
    id: '6', name: 'Lentil & Sweet Potato Stew', emoji: '🍲', category: 'Dinner',
    tags: ['Vegan', 'High Fibre', 'Iron-Rich'],
    time: 35, calories: 390, protein: 18, carbs: 68, fat: 6, servings: 2,
    ingredients: ['1 cup red lentils (rinsed)', '1 large sweet potato (diced)', '1 can diced tomatoes', '1 onion (chopped)', '3 cloves garlic', '1 tsp cumin', '1 tsp turmeric', '1 tsp paprika', '2 cups vegetable stock', 'Fresh coriander to garnish'],
    steps: ['Sauté onion and garlic in oil until soft, about 5 min', 'Add spices, stir for 1 minute', 'Add lentils, sweet potato, tomatoes and stock', 'Bring to boil, reduce heat, simmer 20–25 min until thick', 'Season with salt, garnish with coriander'],
    tip: 'Excellent for genotype AS — high iron from lentils supports haemoglobin. Pair with vitamin C for better iron absorption.'
  },
  {
    id: '7', name: 'Overnight Chia Pudding', emoji: '🍮', category: 'Breakfast',
    tags: ['Prep Ahead', 'Low Sugar', 'Omega-3'],
    time: 5, calories: 310, protein: 14, carbs: 34, fat: 16, servings: 1,
    ingredients: ['4 tbsp chia seeds', '250ml unsweetened oat milk', '1 tsp vanilla extract', '1 tsp maple syrup', 'Seasonal berries', '2 tbsp Greek yoghurt (optional)', 'Pinch of cinnamon'],
    steps: ['Mix chia seeds, oat milk, vanilla and maple syrup in a jar', 'Stir well, ensuring no clumps', 'Refrigerate overnight (minimum 4 hours)', 'In the morning, top with berries, yoghurt and cinnamon', 'Stir before eating'],
    tip: 'Chia seeds are one of the richest plant sources of omega-3 fatty acids. Great for all blood types.'
  },
  {
    id: '8', name: 'Turkey & Avocado Lettuce Wraps', emoji: '🥬', category: 'Lunch',
    tags: ['Low Carb', 'High Protein', 'Keto-Friendly'],
    time: 10, calories: 360, protein: 34, carbs: 12, fat: 20, servings: 1,
    ingredients: ['150g lean turkey mince (cooked)', '4 large romaine lettuce leaves', '1/2 avocado (sliced)', '1/4 red onion (finely diced)', '1 tomato (diced)', '1 tbsp lime juice', 'Handful coriander', 'Salt, pepper, cumin to taste'],
    steps: ['Season turkey mince with cumin, salt and pepper, cook through', 'Lay lettuce leaves flat as wraps', 'Divide turkey, avocado, tomato, and onion between leaves', 'Squeeze lime juice over fillings', 'Top with coriander and roll up or eat open'],
    tip: 'Perfect for blood type O and low-carb goals. Avocado provides healthy monounsaturated fats for heart health.'
  },
];

const categories = ['All', 'Breakfast', 'Lunch', 'Dinner', 'Snack'];

export function Recipes() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [selected, setSelected] = useState<Recipe | null>(null);

  const filtered = recipes.filter(r => {
    const matchCat = category === 'All' || r.category === category;
    const matchSearch = !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.tags.some(t => t.toLowerCase().includes(search.toLowerCase()));
    return matchCat && matchSearch;
  });

  return (
    <div className="min-h-screen bg-background pb-nav">
      <div className="px-4 pt-6 pb-4 space-y-4 max-w-lg mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <Link href="/settings">
            <Button variant="ghost" size="icon"><ChevronLeft className="w-6 h-6" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold font-display flex items-center gap-2"><ChefHat className="w-6 h-6 text-orange-400" />Recipes</h1>
            <p className="text-xs text-muted-foreground">Healthy meals matched to your health profile</p>
          </div>
        </motion.div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search recipes or tags…" value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-muted-foreground" /></button>}
        </div>

        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn('shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors', category === c ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground')}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filtered.map((recipe, i) => (
            <motion.div key={recipe.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card
                className="p-4 cursor-pointer glass-hover"
                onClick={() => setSelected(recipe)}
              >
                <div className="flex gap-3 items-start">
                  <span className="text-3xl">{recipe.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm leading-tight">{recipe.name}</p>
                      <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1"><Clock className="w-3 h-3" />{recipe.time}m</span>
                    </div>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {recipe.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{tag}</span>
                      ))}
                    </div>
                    <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Flame className="w-3 h-3 text-orange-400" />{recipe.calories} cal</span>
                      <span>P: {recipe.protein}g</span>
                      <span>C: {recipe.carbs}g</span>
                      <span>F: {recipe.fat}g</span>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12">
              <ChefHat className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No recipes match "{search}"</p>
            </div>
          )}
        </div>
      </div>

      {/* Recipe detail dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <span>{selected.emoji}</span>
                  {selected.name}
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-4 gap-2 text-center mt-1">
                {[
                  { label: 'Calories', value: `${selected.calories}`, unit: 'kcal' },
                  { label: 'Protein', value: `${selected.protein}g`, unit: '' },
                  { label: 'Carbs', value: `${selected.carbs}g`, unit: '' },
                  { label: 'Fat', value: `${selected.fat}g`, unit: '' },
                ].map(m => (
                  <div key={m.label} className="bg-muted/40 rounded-xl p-2">
                    <p className="font-bold text-sm text-foreground">{m.value}</p>
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{selected.time} min</span>
                <span>{selected.category}</span>
                <span>{selected.servings} serving{selected.servings > 1 ? 's' : ''}</span>
              </div>

              <div>
                <p className="font-semibold text-sm mb-2">Ingredients</p>
                <ul className="space-y-1">
                  {selected.ingredients.map((ing, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{ing}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="font-semibold text-sm mb-2">Method</p>
                <ol className="space-y-2">
                  {selected.steps.map((step, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">{i + 1}</span>
                      <span className="leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {selected.tip && (
                <div className="rounded-xl bg-primary/10 border border-primary/20 p-3">
                  <p className="text-xs text-primary font-semibold mb-1">💡 Ovia's Food Therapy Tip</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{selected.tip}</p>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}
