import { useState } from 'react';
import { Link } from 'wouter';
import { ChevronLeft, Mail, MessageCircle, BookOpen, AlertCircle, Heart, Shield, Zap, Star, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

import { STRIPE_DONATION_URL, DONATION_ACTIVE } from '@/lib/constants';

const TIERS = [
  {
    icon: Shield,
    name: 'Foundation',
    color: 'text-primary',
    bg: 'bg-primary/10',
    badge: 'bg-primary/20 text-primary',
    label: 'Free Forever',
    desc: 'Full access to every feature — workouts, nutrition, Ovia AI (15/day), community, analytics, export. No subscription. No catch.',
  },
  {
    icon: Zap,
    name: 'Rise',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    badge: 'bg-blue-400/20 text-blue-400',
    label: 'Support Tier',
    desc: 'Optional donation identity. Unlocks 200 Ovia AI messages/day, priority badge, and extended history. Coming soon.',
  },
  {
    icon: Star,
    name: 'Reign',
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
    badge: 'bg-purple-400/20 text-purple-400',
    label: 'Support Tier',
    desc: 'Optional donation identity. Unlocks 500 Ovia AI messages/day, AI meal plans, and advanced analytics. Coming soon.',
  },
  {
    icon: Crown,
    name: 'Legacy',
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10',
    badge: 'bg-yellow-400/20 text-yellow-400',
    label: 'Support Tier',
    desc: 'Optional donation identity. Unlimited Ovia AI, 1-on-1 coaching access, and Legacy founder badge. Coming soon.',
  },
];

export function Support() {

  return (
    <div className="min-h-screen bg-background pb-nav">
      <div className="px-4 pt-6 pb-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold font-display">Support</h1>
            <p className="text-sm text-muted-foreground">We're here to help</p>
          </div>
        </div>

        <div className="space-y-4">

          {/* Membership tiers */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-white/10 rounded-2xl p-5"
          >
            <p className="text-sm font-semibold mb-1">RAIMZEAL Membership Tiers</p>
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              The Foundation Plan is free forever. Rise, Reign, and Legacy are optional support/donation identities — they unlock higher Ovia AI limits and supporter badges for members who choose to contribute, but they never restrict access to core features.
            </p>
            <div className="space-y-2">
              {TIERS.map((tier) => {
                const Icon = tier.icon;
                return (
                  <div key={tier.name} className={`flex items-start gap-3 rounded-xl p-3 ${tier.bg}`}>
                    <div className={`w-8 h-8 rounded-lg bg-background/50 flex items-center justify-center shrink-0`}>
                      <Icon className={`w-4 h-4 ${tier.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className={`text-sm font-bold ${tier.color}`}>{tier.name}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tier.badge}`}>{tier.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{tier.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Donation CTA */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-card border border-primary/20 rounded-2xl p-5 glass-emerald shimmer"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Voluntary Donation</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  A voluntary donation keeps the staff and platform running for everyone. Any amount helps — you are never required to give anything.
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">donate.stripe.com · Secure · No account required</p>
              </div>
              {DONATION_ACTIVE ? (
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <motion.a
                    href={STRIPE_DONATION_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold cursor-pointer"
                    animate={{ scale: [1, 1.07, 1, 1.07, 1] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', repeatDelay: 4 }}
                    aria-label="Donate to support RAIMZEAL"
                  >
                    <Heart className="w-4 h-4 fill-current" />
                    Donate
                  </motion.a>
                </div>
              ) : (
                <p className="shrink-0 text-xs text-muted-foreground italic text-right">Donation link<br />coming soon.</p>
              )}
            </div>
          </motion.div>

          {/* Email support */}
          <div className="bg-card border border-white/10 rounded-2xl p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground mb-1">Email Support</h2>
                <p className="text-sm text-muted-foreground mb-3">
                  For account issues, donation questions, and technical problems.
                </p>
                <a
                  href="mailto:support@raimzeal.com"
                  className="text-primary text-sm font-medium hover:underline"
                >
                  support@raimzeal.com
                </a>
                <p className="text-xs text-muted-foreground mt-1">Response within 24–48 hours</p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-white/10 rounded-2xl p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center shrink-0">
                <MessageCircle className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground mb-1">Ovia AI Coach</h2>
                <p className="text-sm text-muted-foreground mb-3">
                  For fitness, nutrition, food therapy, and health awareness questions — ask Ovia directly in the app.
                </p>
                <Link href="/coach">
                  <Button size="sm" variant="outline">Open Ovia AI</Button>
                </Link>
              </div>
            </div>
          </div>

          <div className="bg-card border border-white/10 rounded-2xl p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground mb-1">Legal</h2>
                <p className="text-sm text-muted-foreground mb-3">
                  Review our policies and terms.
                </p>
                <div className="flex gap-3">
                  <Link href="/privacy">
                    <Button size="sm" variant="outline">Privacy Policy</Button>
                  </Link>
                  <Link href="/terms">
                    <Button size="sm" variant="outline">Terms of Service</Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card border border-white/10 rounded-2xl p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground mb-1">Account Deletion</h2>
                <p className="text-sm text-muted-foreground mb-3">
                  To permanently delete your account and all associated data, email us with subject
                  "Account Deletion Request" from the email address registered to your account.
                  We will process your request within 7 days.
                </p>
                <a
                  href="mailto:support@raimzeal.com?subject=Account%20Deletion%20Request"
                  className="text-red-400 text-sm font-medium hover:underline"
                >
                  Request account deletion →
                </a>
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground pt-2">
            RAIMZEAL · <a href="https://raimzeal.com" className="hover:underline">raimzeal.com</a> · Created and powered by ECONTEUR LLC
          </p>
        </div>
      </div>
    </div>
  );
}
