import { useState, useEffect, useMemo } from 'react';
import { Link } from 'wouter';
import { ChevronLeft, Plus, X, ShoppingCart, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { BottomNav } from '@/components/BottomNav';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'raimzeal_grocery_list_v1';

interface GroceryItem { id: string; name: string; purchased: boolean; addedAt: number; }

const QUICK_ADDS = [
  'Spinach', 'Eggs', 'Oats', 'Blueberries', 'Chicken breast', 'Salmon',
  'Greek yogurt', 'Avocado', 'Broccoli', 'Sweet potato', 'Almonds', 'Lentils',
  'Bananas', 'Olive oil', 'Brown rice', 'Beans',
];

function uid(): string {
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function GroceryList() {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as GroceryItem[];
        if (Array.isArray(parsed)) setItems(parsed);
      }
    } catch { /* keep empty */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* ignore */ }
  }, [items, hydrated]);

  const addItem = (rawName: string) => {
    const name = rawName.trim();
    if (!name) return;
    setItems(prev => {
      const existing = prev.find(it => !it.purchased && it.name.toLowerCase() === name.toLowerCase());
      if (existing) return prev;
      return [{ id: uid(), name, purchased: false, addedAt: Date.now() }, ...prev];
    });
    setDraft('');
  };
  const toggle = (id: string) => setItems(prev => prev.map(it => it.id === id ? { ...it, purchased: !it.purchased } : it));
  const remove = (id: string) => setItems(prev => prev.filter(it => it.id !== id));
  const clearPurchased = () => setItems(prev => prev.filter(it => !it.purchased));

  const { toBuy, inCart } = useMemo(() => ({
    toBuy: items.filter(it => !it.purchased),
    inCart: items.filter(it => it.purchased),
  }), [items]);

  const suggestions = QUICK_ADDS.filter(
    s => !items.some(it => !it.purchased && it.name.toLowerCase() === s.toLowerCase())
  ).slice(0, 10);

  const Row = ({ it }: { it: GroceryItem }) => (
    <Card className="p-3 flex items-center gap-3">
      <button onClick={() => toggle(it.id)} className="flex items-center gap-3 flex-1 text-left">
        <span className={cn(
          'w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0',
          it.purchased ? 'border-primary bg-primary' : 'border-border',
        )}>
          {it.purchased && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
        </span>
        <span className={cn('text-sm font-medium', it.purchased ? 'text-muted-foreground line-through' : 'text-foreground')}>
          {it.name}
        </span>
      </button>
      <button onClick={() => remove(it.id)} className="text-muted-foreground hover:text-foreground">
        <X className="w-4 h-4" />
      </button>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background pb-nav">
      <div className="px-4 pt-6 pb-4 space-y-4 max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Link href="/nutrition">
            <Button variant="ghost" size="icon"><ChevronLeft className="w-6 h-6" /></Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Grocery List</h1>
            <p className="text-sm text-muted-foreground">{toBuy.length} to buy · {inCart.length} in cart</p>
          </div>
          {inCart.length > 0 && (
            <button onClick={clearPurchased} className="text-sm font-semibold text-primary">Clear cart</button>
          )}
        </div>

        {/* Add row */}
        <Card className="p-2 pl-3 flex items-center gap-2">
          <Input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addItem(draft); }}
            placeholder="Add an item…"
            className="border-0 bg-transparent focus-visible:ring-0 px-0"
          />
          <Button size="icon" onClick={() => addItem(draft)} disabled={!draft.trim()} className="shrink-0">
            <Plus className="w-5 h-5" />
          </Button>
        </Card>

        {/* Quick adds */}
        {suggestions.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground mb-2">Quick add</h3>
            <div className="flex flex-wrap gap-2">
              {suggestions.map(s => (
                <button
                  key={s}
                  onClick={() => addItem(s)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-border bg-card text-sm font-medium hover:border-primary/50"
                >
                  <Plus className="w-3.5 h-3.5 text-primary" /> {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* To buy */}
        <div>
          <h3 className="text-sm font-semibold mb-2">To buy ({toBuy.length})</h3>
          {toBuy.length === 0 ? (
            <Card className="p-6 flex flex-col items-center gap-2">
              <ShoppingCart className="w-7 h-7 text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center">Nothing to buy yet. Add items above or tap a quick-add.</p>
            </Card>
          ) : (
            <div className="space-y-2">{toBuy.map(it => <Row key={it.id} it={it} />)}</div>
          )}
        </div>

        {/* In cart */}
        {inCart.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-2">In cart ({inCart.length})</h3>
            <div className="space-y-2">{inCart.map(it => <Row key={it.id} it={it} />)}</div>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
