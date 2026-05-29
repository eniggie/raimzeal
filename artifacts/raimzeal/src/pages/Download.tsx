import { useState } from 'react';
import { motion } from 'framer-motion';
import { Smartphone, Download as DownloadIcon, Shield, CheckCircle2, ChevronRight, AlertTriangle, ExternalLink } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';

const APK_URL = 'https://expo.dev/accounts/econteur/projects/raimzeal/builds';
const DIRECT_APK_URL: string | null = null;

const steps = [
  {
    n: 1,
    title: 'Download the APK',
    body: 'Tap the button below to download the RAIMZEAL APK file to your Android phone.',
  },
  {
    n: 2,
    title: 'Allow installation from unknown sources',
    body: 'Android will ask for permission. Go to Settings → Security (or Apps) → Install unknown apps → allow your browser or file manager.',
  },
  {
    n: 3,
    title: 'Open the downloaded file',
    body: 'Find the .apk file in your Downloads folder and tap it to start the installer.',
  },
  {
    n: 4,
    title: 'Install and open',
    body: 'Tap Install, then Open. Sign in or create your free RAIMZEAL account and you\'re ready.',
  },
];

export function Download() {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 glass-strong border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <Link href="/">
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            <ChevronRight className="w-5 h-5 rotate-180" />
          </button>
        </Link>
        <h1 className="font-semibold text-base">Get the Android App</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 max-w-lg mx-auto w-full">

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 mb-6 text-center"
        >
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Smartphone className="w-12 h-12 text-primary" />
          </div>
          <h2 className="text-2xl font-bold font-display mb-2">RAIMZEAL for Android</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Free to download. No Play Store needed.<br />
            Health, fitness & food therapy — all in one app.
          </p>
        </motion.div>

        {/* Download button */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          {DIRECT_APK_URL ? (
            <Button asChild size="lg" className="w-full gap-2 text-base font-semibold h-14 rounded-2xl">
              <a href={DIRECT_APK_URL} download>
                <DownloadIcon className="w-5 h-5" />
                Download APK (Android)
              </a>
            </Button>
          ) : (
            <Button asChild size="lg" className="w-full gap-2 text-base font-semibold h-14 rounded-2xl">
              <a href={APK_URL} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-5 h-5" />
                Get APK from Expo Builds
              </a>
            </Button>
          )}

          <p className="text-center text-xs text-muted-foreground mt-3">
            Android 9.0 (Pie) or later required · Free · No ads
          </p>
        </motion.div>

        {/* Security notice */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4 mb-6 flex gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-200 mb-1">Installing outside the Play Store</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Android will warn you about apps from unknown sources. This is normal for direct APK installs.
              RAIMZEAL is built by ECONTEUR LLC — a legitimate non-profit health platform.
            </p>
          </div>
        </motion.div>

        {/* Steps */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <h3 className="font-semibold mb-4 text-sm uppercase tracking-wide text-muted-foreground">How to install</h3>
          <div className="space-y-3">
            {steps.map((step, i) => (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.07 }}
                className="flex gap-4 p-4 rounded-2xl glass border border-white/8"
              >
                <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-primary text-sm font-bold">{step.n}</span>
                </div>
                <div>
                  <p className="font-medium text-sm mb-1">{step.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{step.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* What's inside */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="rounded-2xl glass border border-white/8 p-4 mb-6"
        >
          <h3 className="font-semibold mb-3 text-sm">What's inside</h3>
          {[
            'Fitness tracking & workout builder',
            'Nutrition logging with AI meal analysis',
            'Ovia AI health coach',
            'Period, PCOS & menopause trackers',
            'Community feed & Legacy Circle',
            'Breathing, mindfulness & sleep tools',
            'Progress photos & body measurements',
            '100% free — no paywalls on core features',
          ].map((f) => (
            <div key={f} className="flex items-center gap-2 py-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
              <span className="text-sm">{f}</span>
            </div>
          ))}
        </motion.div>

        {/* Share link */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-center pb-4"
        >
          <p className="text-xs text-muted-foreground mb-3">Know someone who needs this?</p>
          <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={copyLink}>
            <Shield className="w-4 h-4" />
            {copied ? 'Link copied!' : 'Copy download link'}
          </Button>
        </motion.div>

        {/* iOS notice */}
        <p className="text-center text-xs text-muted-foreground/50 pb-6">
          iPhone version coming soon. For now, use the web app at this site.
        </p>
      </div>
    </div>
  );
}
