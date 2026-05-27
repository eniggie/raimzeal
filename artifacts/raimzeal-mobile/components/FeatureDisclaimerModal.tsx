import React, { useEffect, useState } from "react";
import {
  Linking,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/useColors";

export interface FeatureDisclaimerConfig {
  storageKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  body: string;
  acceptLabel?: string;
  showCrisisLine?: boolean;
}

interface Props {
  config: FeatureDisclaimerConfig;
  onAccepted?: () => void;
}

export function FeatureDisclaimerModal({ config, onAccepted }: Props) {
  const colors = useColors();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(config.storageKey).then((val) => {
      if (!cancelled && !val) setVisible(true);
    });
    return () => { cancelled = true; };
  }, [config.storageKey]);

  async function handleAccept() {
    await AsyncStorage.setItem(config.storageKey, "1");
    setVisible(false);
    onAccepted?.();
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.iconWrap, { backgroundColor: config.iconColor + "20" }]}>
            <Ionicons name={config.icon} size={28} color={config.iconColor} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>{config.title}</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>{config.body}</Text>

          {config.showCrisisLine && (
            <TouchableOpacity
              onPress={() => Linking.openURL("tel:988")}
              style={[styles.crisisBtn, { borderColor: "#ef444440" }]}
              activeOpacity={0.8}
            >
              <Ionicons name="heart-outline" size={15} color="#ef4444" />
              <Text style={[styles.crisisBtnText, { color: "#ef4444" }]}>
                Crisis support: call or text 988
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={handleAccept}
            style={[styles.btn, { backgroundColor: config.iconColor }]}
            activeOpacity={0.85}
          >
            <Text style={[styles.btnText, { color: "#ffffff" }]}>
              {config.acceptLabel ?? "I understand — continue"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  sheet: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 12,
    maxWidth: 380,
    width: "100%",
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: { fontSize: 20, fontFamily: "SpaceGrotesk_700Bold", textAlign: "center" },
  body: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
    textAlign: "center",
  },
  crisisBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  crisisBtnText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  btn: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 4,
    width: "100%",
    alignItems: "center",
  },
  btnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
