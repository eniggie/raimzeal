import { motion } from 'framer-motion';
import { Link } from 'wouter';
import { CheckCircle2, Home, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BottomNav } from '@/components/BottomNav';

export function Welcome() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 pb-32">
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 260 }}
        className="flex flex-col items-center text-center max-w-sm w-full gap-6"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 14, stiffness: 280, delay: 0.1 }}
          className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center"
        >
          <CheckCircle2 className="w-10 h-10 text-primary" />
        </motion.div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold font-display text-foreground">
            Subscription Activated
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Welcome to the RAIMZEAL supporter family. Your plan is now active — thank you for keeping the platform free for everyone.
          </p>
        </div>

        <div className="rounded-2xl glass-emerald shimmer px-5 py-4 w-full text-left">
          <div className="flex items-center gap-2 mb-1">
            <Crown className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold text-primary">What happens next</p>
          </div>
          <ul className="space-y-1 text-xs text-foreground/70 leading-relaxed">
            <li>• Your expanded Ovia AI limits are now active</li>
            <li>• Your supporter badge will appear on your profile</li>
            <li>• Manage or cancel anytime from your Settings page</li>
            <li>• A receipt was sent to your email by Stripe</li>
          </ul>
        </div>

        <div className="flex flex-col gap-3 w-full">
          <Link href="/">
            <Button className="w-full" size="lg">
              <Home className="w-4 h-4 mr-2" />
              Go to Home
            </Button>
          </Link>
          <Link href="/membership">
            <Button variant="outline" className="w-full" size="lg">
              View Membership
            </Button>
          </Link>
        </div>
      </motion.div>

      <BottomNav />
    </div>
  );
}
