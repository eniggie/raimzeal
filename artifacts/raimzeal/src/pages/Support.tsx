import { Link } from 'wouter';
import { ChevronLeft, Mail, MessageCircle, BookOpen, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Support() {
  return (
    <div className="min-h-screen bg-background pb-24">
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
