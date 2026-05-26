import { useLocation, Link } from 'wouter';
import { Home, Dumbbell, BarChart3, Bot, User, Utensils, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/workouts', icon: Dumbbell, label: 'Workouts' },
  { path: '/coach', icon: Bot, label: 'Ovia AI' },
  { path: '/nutrition', icon: Utensils, label: 'Nutrition' },
  { path: '/tracking', icon: BarChart3, label: 'Progress' },
  { path: '/community', icon: Users, label: 'Community' },
  { path: '/settings', icon: User, label: 'Profile' },
];

export function BottomNav() {
  const [location] = useLocation();

  return (
    /*
     * Outer container: fixed to the very bottom of the viewport (bottom:0).
     * We use paddingBottom to extend into the safe-area-inset so the pill
     * never overlaps the iPhone home indicator, and the container never leaves
     * a gap between itself and the actual screen edge.
     * This is far more reliable across mobile browsers than using `bottom: calc(…)`
     * because fixed elements always anchor to the visual viewport at bottom:0.
     */
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Floating pill — mx-4 + max-w-lg keeps it centred and off the edges */}
      <div className="mx-4 mb-4 max-w-lg mx-auto glass-strong glass-nav-edge rounded-2xl border-white/20 shadow-xl overflow-hidden pointer-events-auto">
        <div className="flex items-center justify-around h-14 px-2">
          {navItems.map((item) => {
            const isActive = location === item.path ||
              (item.path !== '/' && location.startsWith(item.path));

            return (
              <Link key={item.path} href={item.path} className="flex-1 flex">
                <motion.div
                  data-testid={`nav-${item.label.toLowerCase()}`}
                  className={cn(
                    'flex flex-col items-center justify-center w-full h-11 rounded-xl transition-colors relative',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )}
                  whileTap={{ scale: 0.9 }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute inset-0 rounded-xl"
                      style={{
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.06) 100%)',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22), 0 2px 12px rgba(0,0,0,0.24)',
                      }}
                      transition={{ type: 'spring', bounce: 0.25, duration: 0.4 }}
                    />
                  )}
                  <item.icon className="w-[18px] h-[18px] relative z-10" strokeWidth={isActive ? 2.5 : 2} />
                  <span className="text-[9px] font-medium mt-0.5 relative z-10 leading-none">{item.label}</span>
                </motion.div>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
