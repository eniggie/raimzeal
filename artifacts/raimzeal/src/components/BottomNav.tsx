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
    <nav className="fixed left-4 right-4 z-50 glass-strong glass-nav-edge rounded-2xl border-white/20 shadow-xl overflow-hidden max-w-lg mx-auto" style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}>
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = location === item.path || 
            (item.path !== '/' && location.startsWith(item.path));
          
          return (
            <Link key={item.path} href={item.path}>
              <motion.div
                data-testid={`nav-${item.label.toLowerCase()}`}
                className={cn(
                  'flex flex-col items-center justify-center flex-1 h-12 rounded-xl transition-colors relative px-0.5',
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
    </nav>
  );
}