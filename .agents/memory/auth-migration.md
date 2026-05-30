---
name: Web Auth Migration — Supabase native
description: Web app signup/login now calls supabase.auth.* directly; API OTP routes removed; profile sync on SIGNED_IN.
---

## Rule
The web app uses Supabase Auth natively (no custom API login/signup endpoints). Email verification is link-based, not OTP.

## Key flows
- **Signup**: `supabase.auth.signUp()` → redirect to `/verify-email` (check-inbox page)
- **Email confirm**: Supabase link → `/auth/callback` → `SIGNED_IN` event → `/`
- **Login**: `supabase.auth.signInWithPassword()` in `Login.tsx` directly
- **Forgot password**: `resetPasswordForEmail({ redirectTo: /auth/callback })` → `PASSWORD_RECOVERY` event → `/reset-password`
- **Auth callback**: `AuthCallback.tsx` handles `SIGNED_IN` (→ `/`) and `PASSWORD_RECOVERY` (→ `/reset-password`). getSession fallback checks `type=recovery` in URL params before picking target.
- **Phone verify**: `/verify-phone` still calls `/api/auth/send-sms-code` and `/api/auth/verify-sms-code` (kept).
- **Profile sync**: `AuthContext` `onAuthStateChange` on `SIGNED_IN` calls `POST /api/auth/sync-profile` (non-fatal upsert).

**Why:** Supabase JS v2 PKCE flow requires the redirect URL to go through `/auth/callback` for reliable code exchange. Pointing `redirectTo` directly at `/reset-password` bypasses the exchange step.

**How to apply:** Always use `${origin}${BASE}/auth/callback` as the `redirectTo` for any Supabase auth email (confirmation, password reset, magic link).
