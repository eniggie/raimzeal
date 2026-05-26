import React, { useEffect, useRef, useState } from "react";
import { Animated, AppState, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const COOLDOWN_MS = 30_000;

/**
 * Shared permission-denied toast hook.
 *
 * Returns `showPermissionToast(message?, actionIcon?)` to trigger the toast and
 * `permissionToastElement` — the JSX to render inside your screen's root View.
 *
 * Pass an optional `actionIcon` to show a small action-specific icon alongside
 * the lock icon (e.g. "camera-outline" for a save-to-camera-roll error), matching
 * the pattern used by CardCustomizationModal for permission errors.
 *
 * The toast fades in (200 ms), holds for 4500 ms, then fades out (400 ms).
 * Tapping it immediately calls `Linking.openSettings()` so the user can
 * re-enable the denied permission without hunting through Settings manually.
 *
 * Per-session cooldown: the same toast message won't re-appear within 30 s of
 * the last show to avoid spamming on repeated taps. The cooldown resets
 * automatically whenever the app returns to the foreground (the user may have
 * changed the permission in Settings).
 */
export function usePermissionToast() {
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [actionIcon, setActionIcon] = useState<keyof typeof Ionicons.glyphMap | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastShownAtRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        lastShownAtRef.current.clear();
      }
    });
    return () => {
      subscription.remove();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function showPermissionToast(
    message = "Photo access blocked — tap to open Settings",
    icon?: keyof typeof Ionicons.glyphMap,
  ) {
    const now = Date.now();
    const lastShown = lastShownAtRef.current.get(message) ?? 0;
    if (now - lastShown < COOLDOWN_MS) return;

    lastShownAtRef.current.set(message, now);

    if (timerRef.current) clearTimeout(timerRef.current);
    setToastMsg(message);
    setActionIcon(icon ?? null);
    toastOpacity.stopAnimation();
    toastOpacity.setValue(0);
    Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    timerRef.current = setTimeout(() => {
      Animated.timing(toastOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setToastMsg(null);
      });
    }, 4500);
  }

  const permissionToastElement = toastMsg ? (
    <Animated.View style={[styles.wrap, { opacity: toastOpacity }]}>
      <TouchableOpacity
        onPress={() => {
          if (timerRef.current) clearTimeout(timerRef.current);
          setToastMsg(null);
          void Linking.openSettings();
        }}
        activeOpacity={0.8}
        style={styles.toast}
      >
        {actionIcon ? (
          <View style={styles.iconPair}>
            <Ionicons name={actionIcon} size={14} color="#ff4436" />
            <Ionicons name="lock-closed-outline" size={10} color="#ff4436" />
          </View>
        ) : (
          <Ionicons name="lock-closed-outline" size={14} color="#ff4436" />
        )}
        <Text style={styles.text}>{toastMsg}</Text>
      </TouchableOpacity>
    </Animated.View>
  ) : null;

  return { showPermissionToast, permissionToastElement };
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    bottom: 32,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 200,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: "#ff443618",
    borderColor: "#ff443640",
  },
  iconPair: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  text: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#ff4436",
  },
});
