import { AnimatePresence, motion } from 'framer-motion';
import { Cloud, CloudOff, Loader2, CheckCircle2 } from 'lucide-react';

type SyncStatus = 'idle' | 'syncing' | 'saved' | 'offline';

interface SyncIndicatorProps {
  status: SyncStatus;
}

const CONFIG = {
  syncing: {
    icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
    label: 'Saving…',
    className: 'bg-muted/90 text-muted-foreground border-border',
  },
  saved: {
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
    label: 'Saved',
    className: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60',
  },
  offline: {
    icon: <CloudOff className="w-3.5 h-3.5 text-amber-400" />,
    label: 'Saved locally — will sync when online',
    className: 'bg-amber-950/80 text-amber-300 border-amber-800/60',
  },
  idle: {
    icon: <Cloud className="w-3.5 h-3.5" />,
    label: '',
    className: '',
  },
} as const;

export function SyncIndicator({ status }: SyncIndicatorProps) {
  const visible = status !== 'idle';
  const cfg = CONFIG[status];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={status}
          initial={{ opacity: 0, y: 8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.95 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className={
            `fixed bottom-20 right-4 z-50 flex items-center gap-1.5 ` +
            `rounded-full border px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur-sm ` +
            cfg.className
          }
        >
          {cfg.icon}
          <span>{cfg.label}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
