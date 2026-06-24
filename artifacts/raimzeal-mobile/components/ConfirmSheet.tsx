import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

interface ConfirmSheetProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const sheetAnim = useRef(new Animated.Value(500)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const [internalVisible, setInternalVisible] = useState(false);
  const isDismissingRef = useRef(false);

  useEffect(() => {
    if (visible) {
      isDismissingRef.current = false;
      setInternalVisible(true);
    } else if (!isDismissingRef.current) {
      setInternalVisible(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!internalVisible) return;
    sheetAnim.setValue(500);
    overlayAnim.setValue(0);
    Animated.parallel([
      Animated.timing(overlayAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(sheetAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }),
    ]).start();
  }, [internalVisible, sheetAnim, overlayAnim]);

  function handleDismiss(callback: () => void) {
    if (isDismissingRef.current) return;
    isDismissingRef.current = true;
    Animated.parallel([
      Animated.timing(overlayAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(sheetAnim, {
        toValue: 500,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start(() => {
      isDismissingRef.current = false;
      setInternalVisible(false);
      callback();
    });
  }

  return (
    <Modal
      visible={internalVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => handleDismiss(onCancel)}
    >
      <Animated.View style={[styles.overlay, { opacity: overlayAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => handleDismiss(onCancel)} />
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: insets.bottom + 16,
              transform: [{ translateY: sheetAnim }],
            },
          ]}
        >
          <Pressable onPress={() => {}}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />

            <Text style={[styles.title, { color: colors.foreground }]}>
              {title}
            </Text>
            <Text style={[styles.message, { color: colors.mutedForeground }]}>
              {message}
            </Text>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => handleDismiss(onConfirm)}
              style={[
                styles.confirmBtn,
                {
                  backgroundColor: destructive
                    ? colors.destructive
                    : colors.primary,
                },
              ]}
            >
              <Text
                style={[
                  styles.confirmBtnText,
                  {
                    color: destructive
                      ? colors.destructiveForeground ?? "#fff"
                      : colors.primaryForeground,
                  },
                ]}
              >
                {confirmLabel}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => handleDismiss(onCancel)}
              style={[
                styles.cancelBtn,
                { backgroundColor: colors.muted },
              ]}
            >
              <Text style={[styles.cancelBtnText, { color: colors.foreground }]}>
                {cancelLabel}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontFamily: "SpaceGrotesk_700Bold",
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 4,
  },
  confirmBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  cancelBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
});
