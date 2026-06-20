---
name: Expo Google Sign-In Pod Failures
description: @react-native-google-signin causes consistent pod install failures in EAS; use expo-auth-session instead
---

## Rule
Never use `@react-native-google-signin/google-signin` in an Expo SDK 50+ managed workflow project. It causes silent "Unknown error. See logs of the Install pods build phase" failures on EAS regardless of version (tested: v13.1.0 and v16.1.2 both fail).

**Why:** The package requires native CocoaPods (`GoogleSignIn` pod). EAS managed workflow builds on Expo SDK 54 / RN 0.81 fail to install this pod with a generic "Unknown error" that is not version-fixable.

**How to apply:** Use `expo-auth-session/providers/google` instead:
- Pure JavaScript OAuth via `Google.useAuthRequest` hook
- `WebBrowser.maybeCompleteAuthSession()` at module level
- `promptAsync()` returns result with `result.authentication?.idToken`
- Pass `idToken` to `supabase.auth.signInWithIdToken({ provider: 'google', token: idToken })`
- No native pods, no app.json plugin needed (remove iosUrlScheme plugin entirely)
- Scopes: `['openid', 'profile', 'email']` to get the id_token in the response
- Hook must live in the component (login screen), not in AuthContext
- Context exposes `signInWithGoogleToken(idToken)` for the Supabase call

## Also: EAS upload from bash tool always times out
- 381 MB archive takes >2 min to upload from Replit bash tool
- From Replit interactive shell: uploads in ~4s (96 MB/s)
- Always trigger EAS builds from user's Replit shell, not from agent bash tool
- Use: `EAS_NO_VCS=1 EAS_BUILD_NO_EXPO_GO_WARNING=true pnpm exec eas build --platform ios --profile production --non-interactive --no-wait`

## expo-auth-session version for SDK 54
Install `expo-auth-session@~7.0.11` (NOT 56.x which is for a newer SDK).
Expo will warn "expected version: ~7.0.11" if wrong version is installed.
