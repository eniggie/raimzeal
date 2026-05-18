import { useLocation, Link } from 'wouter';
import { Home, Dumbbell, BarChart3, Calendar, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/workouts', icon: Dumbbell, label: 'Workouts' },
  { path: '/tracking', icon: BarChart3, label: 'Progress' },
  { path: '/calendar', icon: Calendar, label: 'Calendar' },
  { path: '/settings', icon: User, label: 'Profile' },
];

export function BottomNav() {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-6 left-4 right-4 z-50 glass-strong safe-area-inset-bottom rounded-2xl border-white/20 shadow-xl overflow-hidden max-w-lg mx-auto">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = location === item.path || 
            (item.path !== '/' && location.startsWith(item.path));
          
          return (
            <Link key={item.path} href={item.path}>
              <motion.div
                data-testid={`nav-${item.label.toLowerCase()}`}
                className={cn(
                  'flex flex-col items-center justify-center w-16 h-12 rounded-xl transition-colors relative',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
                whileTap={{ scale: 0.9 }}
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute inset-0 bg-white/10 rounded-xl"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                  />
                )}
                <item.icon className="w-5 h-5 relative z-10" strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-medium mt-0.5 relative z-10">{item.label}</span>
              </motion.div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}