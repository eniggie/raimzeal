# AUTH_DIAGNOSIS.md
> Diagnosis of the fake authentication system in `artifacts/raimzeal` (PWA web app).
> **No code has been changed.** This is a read-only audit.

---

## 1. Where is the login form? What happens when the button is clicked?

**File:** `artifacts/raimzeal/src/pages/Login.tsx`

The form has an email field and a password field. When the Sign In button is clicked:

```
handleSubmit()
  → await new Promise(resolve => setTimeout(resolve, 800))  // fake delay
  → onLogin(email, password)                                 // prop callback
```

That `onLogin` prop is wired in `App.tsx` (line 66–69):

```tsx
onLogin={(email, password) => {
  login(email, password);   // calls store.ts login()
  setShowLogin(false);
}}
```

`login()` lives in `artifacts/raimzeal/src/lib/store.ts` (line 237–258):

```ts
const login = (email: string, _password: string) => {
  // _password is explicitly unused — prefixed with _ to suppress the lint warning
  const demoUser: UserProfile = {
    id: 'demo',
    name: 'Demo User',
    email,         // email is accepted but never verified
    ...
  };
  setState(prev => ({ ...prev, isOnboarded: true, isLoggedIn: true, user: demoUser, ...sampleData }));
};
```

**Result:** Any email address and any password — including empty strings — grants full access.

There is also a "Try Demo Mode" button that calls `onLogin('demo@raimzeal.fit', 'demo123')`, which takes the exact same code path.

---

## 2. Is there ANY call to Supabase auth?

**No. Zero.**

A full grep of `artifacts/raimzeal/src/` for `signInWithPassword`, `signUp`, `signOut`, `supabase.auth`, `resetPasswordForEmail`, `createClient`, `@supabase/supabase-js` returns **no matches at all**.

Supabase does not exist in the web app source code.

---

## 3. Where is the password checked?

**Nowhere.**

The `_password` parameter in `store.ts → login()` is intentionally unused (the underscore prefix is a TypeScript/JS convention meaning "I know this is unused"). The function never reads it, never hashes it, never compares it to anything. Any string — or no string — passes.

---

## 4. Is there a real users table? Is auth bypassed entirely?

Auth is bypassed entirely. There is no database involved in the web app at all.

All app data — including the logged-in flag — is stored in the browser's `localStorage` under the key `raimzeal_fitness_data` as a plain JSON blob (see `store.ts` line 3–4 and lines 200–220). There is no network call to any backend during login. No users table is queried. No credentials are validated anywhere.

The `user` object stored in state has a hardcoded `id: 'demo'` regardless of which email address was typed.

---

## 5. Is Supabase Auth even enabled? Are env vars set?

**The API server (Node/Express) does use Supabase** — `artifacts/api-server/src/middleware/auth.ts` contains a real `requireAuth` middleware that validates Supabase JWTs using `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. So a Supabase project exists and its URL/anon key are available as Replit secrets.

**The web app has never been connected to it.** Specifically:

| Check | Result |
|-------|--------|
| `@supabase/supabase-js` in `artifacts/raimzeal/package.json` | ❌ Not installed |
| `VITE_SUPABASE_URL` env var | ❌ Does not exist |
| `VITE_SUPABASE_ANON_KEY` env var | ❌ Does not exist |
| Any `createClient` call in `artifacts/raimzeal/src/` | ❌ None found |

The existing Supabase secrets (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`) are the right values to use — they just need to be exposed to Vite under `VITE_` prefixed names, or the existing secret names need to be referenced directly.

---

## 6. Every place that fakes a logged-in state

| Location | Line(s) | What it does |
|----------|---------|--------------|
| `src/lib/store.ts` | 71 | Declares `isLoggedIn: boolean` as part of `AppState` |
| `src/lib/store.ts` | 90 | Initialises `isLoggedIn: false` in `defaultState` |
| `src/lib/store.ts` | 218–220 | **Persists entire state to `localStorage`** including `isLoggedIn: true` — so staying "logged in" across page refreshes works with no real session |
| `src/lib/store.ts` | 200–216 | **Reads state back from `localStorage` on init** — if `isLoggedIn: true` is in storage, user is considered logged in with no token check |
| `src/lib/store.ts` | 231 | `isLoggedIn: true` set unconditionally inside `completeOnboarding()` (the new-user signup flow) |
| `src/lib/store.ts` | 252 | `isLoggedIn: true` set unconditionally inside `login()` regardless of credentials |
| `src/lib/store.ts` | 260–262 | `logout()` just calls `setState(defaultState)` — resets the object in memory and removes it from localStorage; no real session is cleared |
| `src/App.tsx` | 62 | Auth gate: `if (!state.isOnboarded && !state.isLoggedIn)` — checks the fake flag only; no JWT or session validation |

---

## 7. service_role key in client code

Grep of entire `artifacts/raimzeal/src/` for `service_role` or `SERVICE_ROLE`: **not found**. ✅

---

## Summary

The web app has no authentication. It is a pure UI mockup where login sets a boolean in
`localStorage`. The Supabase project exists and is already used by the API server and mobile
app, but the web app (`artifacts/raimzeal`) was never wired up to it.

**What is needed before Step 2 can begin:**

1. **Your approval** of this diagnosis.
2. Two new Replit secrets (or confirm the existing ones can be reused under `VITE_` names):
   - `VITE_SUPABASE_URL` — same value as `EXPO_PUBLIC_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` — same value as `EXPO_PUBLIC_SUPABASE_ANON_KEY`
3. **Supabase dashboard confirmation** that Email auth is enabled under
   Authentication → Providers → Email (and whether "Confirm email" is on).
4. The redirect URL `https://raimzeal.com/auth/callback` must be added to the
   Supabase project's allowed redirect URLs
   (Authentication → URL Configuration → Redirect URLs).

No code has been changed. Awaiting your approval to proceed.
