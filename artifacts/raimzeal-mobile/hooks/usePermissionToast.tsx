import React, { useEffect, useRef, useState } from "react";
import { Animated, Linking, StyleSheet, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

/**
 * Shared permission-denied toast hook.
 *
 * Returns `showPermissionToast(message?)` to trigger the toast and
 * `permissionToastElement` — the JSX to render inside your screen's root View.
 *
 * The toast fades in (200 ms), holds for 4500 ms, then fades out (400 ms).
 * Tapping it immediately calls `Linking.openSettings()` so the user can
 * re-enable the denied permission without hunting through Settings manually.
 */
export function usePermissionToast() {
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function showPermissionToast(message = "Photo access blocked — tap to open Settings") {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToastMsg(message);
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
        <Ionicons name="lock-closed-outline" size={14} color="#ff4436" />
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
  text: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#ff4436",
  },
});
