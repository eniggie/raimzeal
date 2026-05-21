import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import {
  getRecentScans,
  removeRecentScan,
  updateRecentScan,
  RecentScan,
  ScannedFood,
} from "@/components/BarcodeScannerModal";
import { ScanEditSheet } from "@/components/ScanEditSheet";

interface Props {
  visible: boolean;
  onClose: () => void;
  onFoodFound: (food: ScannedFood) => void;
}

function formatScannedDate(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;

  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function RecentlyScannedModal({ visible, onClose, onFoodFound }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [scans, setScans] = useState<RecentScan[]>([]);
  const [loading, setLoading] = useState(false);
  const [editTarget, setEditTarget] = useState<RecentScan | null>(null);

  const loadScans = useCallback(async () => {
    setLoading(true);
    const data = await getRecentScans();
    setScans(data);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    if (visible) {
      loadScans();
    }
  }, [visible, loadScans]);

  async function handleRemove(barcode: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await removeRecentScan(barcode);
    setScans((prev) => prev.filter((s) => s.barcode !== barcode));
  }

  function handleSelect(food: ScannedFood) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onFoodFound(food);
    onClose();
  }

  function handleLongPress(scan: RecentScan) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEditTarget(scan);
  }

  async function handleSaveEdit(updated: ScannedFood) {
    if (!editTarget) return;
    await updateRecentScan(editTarget.barcode, updated);
    setScans((prev) =>
      prev.map((s) =>
        s.barcode === editTarget.barcode ? { ...s, food: updated } : s
      )
    );
    setEditTarget(null);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          {/* Handle bar */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons
                name="time-outline"
                size={20}
                color={colors.primary}
              />
              <Text style={[styles.title, { color: colors.foreground }]}>
                Recently Scanned
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <ScanEditSheet
            visible={editTarget !== null}
            food={editTarget?.food ?? null}
            onSave={handleSaveEdit}
            onClose={() => setEditTarget(null)}
          />

          {/* Content */}
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : scans.length === 0 ? (
            <View style={styles.center}>
              <Ionicons
                name="barcode-outline"
                size={48}
                color={colors.mutedForeground}
              />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                No recent scans
              </Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                Products you scan will appear here so you can quickly add them again.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                Tap to add · Long-press to edit
              </Text>
              {scans.map((scan) => (
                <TouchableOpacity
                  key={scan.barcode}
                  onPress={() => handleSelect(scan.food)}
                  onLongPress={() => handleLongPress(scan)}
                  delayLongPress={400}
                  activeOpacity={0.75}
                  style={[
                    styles.item,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <View
                    style={[
                      styles.iconBox,
                      { backgroundColor: colors.primary + "18" },
                    ]}
                  >
                    <Ionicons
                      name="barcode-outline"
                      size={20}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.itemInfo}>
                    <Text
                      style={[styles.itemName, { color: colors.foreground }]}
                      numberOfLines={1}
                    >
                      {scan.food.name}
                    </Text>
                    <View style={styles.itemMeta}>
                      <Text
                        style={[styles.itemCal, { color: colors.primary }]}
                      >
                        {scan.food.calories} kcal
                      </Text>
                      <Text
                        style={[styles.itemDot, { color: colors.mutedForeground }]}
                      >
                        ·
                      </Text>
                      <Text
                        style={[styles.itemMacros, { color: colors.mutedForeground }]}
                      >
                        P {scan.food.protein}g · C {scan.food.carbs}g · F {scan.food.fat}g
                      </Text>
                    </View>
                    <Text
                      style={[styles.itemDate, { color: colors.mutedForeground }]}
                    >
                      {formatScannedDate(scan.scannedAt)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRemove(scan.barcode)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.removeBtn}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={17}
                      color={colors.mutedForeground}
                    />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "82%",
    minHeight: 260,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 48,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  emptySub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 10,
  },
  hint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 4,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  itemMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
  },
  itemCal: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  itemDot: {
    fontSize: 13,
  },
  itemMacros: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  itemDate: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  removeBtn: {
    padding: 4,
  },
});
