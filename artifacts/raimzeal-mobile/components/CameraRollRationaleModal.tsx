import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

interface CameraRollRationaleModalProps {
  visible: boolean;
  onAllow: () => void;
}

export function CameraRollRationaleModal({
  visible,
  onAllow,
}: CameraRollRationaleModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.65)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 24,
      paddingTop: 28,
      paddingBottom: Math.max(insets.bottom, 24),
    },
    iconWrapper: {
      alignSelf: "center",
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 20,
    },
    title: {
      color: colors.text,
      fontSize: 20,
      fontFamily: "SpaceGrotesk_700Bold",
      textAlign: "center",
      marginBottom: 12,
    },
    body: {
      color: colors.mutedForeground,
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
      lineHeight: 22,
      marginBottom: 8,
    },
    privacy: {
      color: colors.mutedForeground,
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
      lineHeight: 18,
      marginBottom: 28,
      opacity: 0.7,
    },
    allowButton: {
      backgroundColor: colors.primary,
      borderRadius: colors.radius,
      paddingVertical: 16,
      alignItems: "center",
      marginBottom: 12,
    },
    allowText: {
      color: colors.primaryForeground,
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
    },
  });

  // App Review 5.1.1(iv): a custom message shown before the system permission
  // request must always lead to that request — no button or dismissal path may
  // let the user delay/skip it. Every way of closing this sheet (backdrop tap,
  // hardware back, the button) proceeds straight to the OS prompt.
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onAllow}
    >
      <Pressable style={styles.overlay} onPress={onAllow}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.iconWrapper}>
            <Ionicons name="images-outline" size={34} color={colors.secondary} />
          </View>

          <Text style={styles.title}>Save to Your Photos</Text>

          <Text style={styles.body}>
            RAIMZEAL can save your nutrition progress cards directly to your
            photo library so you can share them any time.
          </Text>

          <Text style={styles.privacy}>
            Your photos are never read, stored, or uploaded — access is only
            used to save cards you create.
          </Text>

          <TouchableOpacity
            style={styles.allowButton}
            onPress={onAllow}
            activeOpacity={0.85}
          >
            <Text style={styles.allowText}>Continue</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
