/**
 * Native Google sign-in via @react-native-google-signin/google-signin.
 *
 * Uses the real native Google flow (not a web browser), which reliably returns an
 * id_token on iOS — unlike expo-auth-session, which couldn't return one on iOS.
 * Setting webClientId makes the id_token's audience the web client ID, which is
 * authorised in Supabase, so `signInWithIdToken` accepts it. No nonce involved.
 */

import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import Constants from "expo-constants";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;
  GoogleSignin.configure({
    iosClientId: extra.googleIosClientId,
    webClientId: extra.googleWebClientId,
    scopes: ["openid", "profile", "email"],
  });
  configured = true;
}

/**
 * Opens the native Google sign-in sheet and returns an id_token.
 * - { idToken, error: null } on success
 * - { idToken: null, error: null } if the user cancelled (no alert needed)
 * - { idToken: null, error: "..." } on a real failure
 */
export async function signInWithGoogleNative(): Promise<{ idToken: string | null; error: string | null }> {
  try {
    ensureConfigured();
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (isSuccessResponse(response)) {
      const idToken = response.data.idToken;
      if (!idToken) return { idToken: null, error: "Google did not return an identity token" };
      return { idToken, error: null };
    }
    // response.type === "cancelled" — user backed out
    return { idToken: null, error: null };
  } catch (e) {
    if (isErrorWithCode(e)) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS) {
        return { idToken: null, error: null };
      }
      return { idToken: null, error: `Google sign-in error (${e.code})` };
    }
    return { idToken: null, error: e instanceof Error ? e.message : "Google sign-in failed" };
  }
}
