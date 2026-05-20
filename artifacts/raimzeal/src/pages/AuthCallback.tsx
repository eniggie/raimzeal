import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export function AuthCallback() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Supabase detectSessionInUrl:true auto-processes the hash token.
    // Wait for the session to be established then redirect.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') {
        const target = event === 'PASSWORD_RECOVERY' ? '/reset-password' : '/';
        setLocation(target);
      }
    });

    // Fallback: if already signed in, go home
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (session) setLocation('/');
      })
      .catch(() => {
        // Session restore failed — stay on callback page; onAuthStateChange will handle SIGNED_IN
      });

    return () => subscription.unsubscribe();
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground">Confirming your account…</p>
      </div>
    </div>
  );
}
