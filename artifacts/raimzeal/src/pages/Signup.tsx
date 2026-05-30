import { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';
import { COUNTRIES_SORTED } from '@/lib/countries';
import { useAuth } from '@/contexts/AuthContext';

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, '') ?? '';

interface Props {
  onLogin: () => void;
}

function passwordStrength(pw: string): { label: string; color: string; width: string } {
  if (!pw) return { label: '', color: '', width: '0%' };
  const has8 = pw.length >= 8;
  const hasNum = /\d/.test(pw);
  const hasLetter = /[a-zA-Z]/.test(pw);
  const hasSpecial = /[^a-zA-Z0-9]/.test(pw);
  const has12 = pw.length >= 12;
  const score = [has8, hasNum, hasLetter, hasSpecial, has12].filter(Boolean).length;
  if (score <= 2) return { label: 'Weak', color: '#ef4444', width: '25%' };
  if (score === 3) return { label: 'Fair', color: '#f59e0b', width: '50%' };
  if (score === 4) return { label: 'Good', color: '#3b82f6', width: '75%' };
  return { label: 'Strong', color: '#2E8B57', width: '100%' };
}

function validatePassword(pw: string): string {
  if (pw.length < 8) return 'Password must be at least 8 characters.';
  if (!/\d/.test(pw)) return 'Password must contain at least one number.';
  if (!/[a-zA-Z]/.test(pw)) return 'Password must contain at least one letter.';
  return '';
}

export default function Signup({ onLogin }: Props) {
  const { signUp } = useAuth();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    dialCode: '+1',
    dialCountry: 'US',
    localPhone: '',
    country: '',
    city: '',
  });
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const strength = passwordStrength(form.password);
  const pwError = form.password ? validatePassword(form.password) : '';

  function set(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: '' }));
    setError('');
  }

  function getPhoneE164(): string {
    if (!form.localPhone) return '';
    try {
      const parsed = parsePhoneNumber(form.dialCode + form.localPhone, form.dialCountry as any);
      return parsed?.number ?? '';
    } catch {
      return form.dialCode + form.localPhone.replace(/\D/g, '');
    }
  }

  function validateForm(): boolean {
    const errs: Record<string, string> = {};
    if (form.fullName.trim().length < 2) errs.fullName = 'Please enter your full name.';
    if (!form.email || !/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Please enter a valid email.';
    const pwErr = validatePassword(form.password);
    if (pwErr) errs.password = pwErr;
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match.';
    if (!form.country) errs.country = 'Please select your country.';
    if (!form.city.trim()) errs.city = 'Please enter your city.';
    if (!agreedTerms) errs.terms = 'You must agree to the terms.';
    if (form.localPhone) {
      const e164 = getPhoneE164();
      if (!e164 || !isValidPhoneNumber(e164)) errs.localPhone = 'Please enter a valid phone number.';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    setError('');

    const phoneE164 = getPhoneE164();
    const phone = form.localPhone ? form.dialCode + form.localPhone : '';

    const { error: signUpError } = await signUp(form.email, form.password, {
      full_name: form.fullName.trim(),
      name: form.fullName.trim(),
      phone,
      phone_e164: phoneE164,
      country: form.country,
      city: form.city.trim(),
    });

    setLoading(false);

    if (signUpError) {
      if (signUpError.toLowerCase().includes('already registered') || signUpError.toLowerCase().includes('already exists')) {
        setError('An account with this email already exists. Try signing in instead.');
      } else {
        setError(signUpError);
      }
      return;
    }

    window.location.href = `${BASE}/verify-email?email=${encodeURIComponent(form.email)}`;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start py-10 px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo + heading */}
        <div className="flex items-center gap-3 mb-8">
          <img src={`${BASE}/favicon.png`} alt="RAIMZEAL" className="w-10 h-10 rounded-xl" />
          <span className="text-xl font-bold font-display">RAIMZEAL</span>
        </div>

        <h1 className="text-3xl font-bold font-display mb-1">Create account</h1>
        <p className="text-muted-foreground mb-6 text-sm">
          Already have an account?{' '}
          <button type="button" onClick={onLogin} className="text-primary font-medium hover:underline">
            Sign in
          </button>
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Full name */}
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              placeholder="Jane Smith"
              value={form.fullName}
              onChange={(e) => set('fullName', e.target.value)}
              className={cn(fieldErrors.fullName && 'border-destructive')}
              autoComplete="name"
            />
            {fieldErrors.fullName && <p className="text-xs text-destructive">{fieldErrors.fullName}</p>}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              className={cn(fieldErrors.email && 'border-destructive')}
              autoComplete="email"
            />
            {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPw ? 'text' : 'password'}
                placeholder="Min. 8 characters"
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                className={cn('pr-10', fieldErrors.password && 'border-destructive')}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                onClick={() => setShowPw((v) => !v)}
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {form.password && (
              <div className="space-y-1">
                <div className="h-1 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: strength.color }}
                    initial={{ width: 0 }}
                    animate={{ width: strength.width }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <p className="text-xs" style={{ color: strength.color }}>{strength.label}</p>
              </div>
            )}
            {fieldErrors.password && <p className="text-xs text-destructive">{fieldErrors.password}</p>}
          </div>

          {/* Confirm password */}
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPw ? 'text' : 'password'}
                placeholder="Re-enter password"
                value={form.confirmPassword}
                onChange={(e) => set('confirmPassword', e.target.value)}
                className={cn('pr-10', fieldErrors.confirmPassword && 'border-destructive')}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                onClick={() => setShowConfirmPw((v) => !v)}
              >
                {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {fieldErrors.confirmPassword && <p className="text-xs text-destructive">{fieldErrors.confirmPassword}</p>}
          </div>

          {/* Phone (optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="localPhone">Phone <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <div className="flex gap-2">
              <select
                value={form.dialCountry}
                onChange={(e) => {
                  const c = COUNTRIES_SORTED.find((x) => x.code === e.target.value);
                  set('dialCountry', e.target.value);
                  if (c) set('dialCode', c.dial);
                }}
                className="h-10 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring w-28 shrink-0"
              >
                {COUNTRIES_SORTED.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.dial}
                  </option>
                ))}
              </select>
              <Input
                id="localPhone"
                type="tel"
                placeholder="Phone number"
                value={form.localPhone}
                onChange={(e) => set('localPhone', e.target.value.replace(/[^\d\s\-().+]/g, ''))}
                className={cn('flex-1', fieldErrors.localPhone && 'border-destructive')}
                autoComplete="tel"
              />
            </div>
            {fieldErrors.localPhone && <p className="text-xs text-destructive">{fieldErrors.localPhone}</p>}
          </div>

          {/* Country */}
          <div className="space-y-1.5">
            <Label htmlFor="country">Country</Label>
            <select
              id="country"
              value={form.country}
              onChange={(e) => set('country', e.target.value)}
              className={cn(
                'w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring',
                fieldErrors.country && 'border-destructive',
                !form.country && 'text-muted-foreground'
              )}
            >
              <option value="">Select country</option>
              {COUNTRIES_SORTED.map((c) => (
                <option key={c.code} value={c.name}>
                  {c.flag} {c.name}
                </option>
              ))}
            </select>
            {fieldErrors.country && <p className="text-xs text-destructive">{fieldErrors.country}</p>}
          </div>

          {/* City */}
          <div className="space-y-1.5">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              placeholder="e.g. New York"
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
              className={cn(fieldErrors.city && 'border-destructive')}
              autoComplete="address-level2"
            />
            {fieldErrors.city && <p className="text-xs text-destructive">{fieldErrors.city}</p>}
          </div>

          {/* Terms */}
          <div className="space-y-1">
            <label className="flex items-start gap-3 cursor-pointer group">
              <div
                onClick={() => { setAgreedTerms((v) => !v); setFieldErrors((p) => ({ ...p, terms: '' })); }}
                className={cn(
                  'mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                  agreedTerms ? 'bg-primary border-primary' : 'border-input hover:border-primary'
                )}
              >
                {agreedTerms && <CheckCircle className="w-3.5 h-3.5 text-primary-foreground" />}
              </div>
              <span className="text-sm text-muted-foreground leading-tight">
                I agree to the{' '}
                <a href={`${BASE}/terms`} className="text-foreground underline" target="_blank" rel="noopener noreferrer">Terms of Service</a>
                {' '}and{' '}
                <a href={`${BASE}/privacy`} className="text-foreground underline" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
              </span>
            </label>
            {fieldErrors.terms && <p className="text-xs text-destructive pl-8">{fieldErrors.terms}</p>}
          </div>

          {/* Global error */}
          {error && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full h-12"
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create account'}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
