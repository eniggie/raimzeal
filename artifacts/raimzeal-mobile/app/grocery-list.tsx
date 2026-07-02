import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { GlassCard } from "@/components/GlassCard";
import { AnimatedPressable } from "@/components/AnimatedPressable";

const STORAGE_KEY = "@raimzeal_grocery_list_v1";

interface GroceryItem {
  id: string;
  name: string;
  qty?: string;
  purchased: boolean;
  addedAt: number;
}

// Wholesome quick-adds aligned with RAIMZEAL's food-therapy focus.
const QUICK_ADDS = [
  "Spinach", "Eggs", "Oats", "Blueberries", "Chicken breast", "Salmon",
  "Greek yogurt", "Avocado", "Broccoli", "Sweet potato", "Almonds", "Lentils",
  "Bananas", "Olive oil", "Brown rice", "Beans",
];

function uid(): string {
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export default function GroceryListScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [items, setItems] = useState<GroceryItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as GroceryItem[];
            if (Array.isArray(parsed)) setItems(parsed);
          } catch {
            /* keep empty */
          }
        }
      })
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)).catch(() => {});
  }, [items, hydrated]);

  const addItem = useCallback((rawName: string) => {
    const name = rawName.trim();
    if (!name) return;
    Haptics.selectionAsync().catch(() => {});
    setItems((prev) => {
      // Merge case-insensitive duplicates that are still un-purchased.
      const existing = prev.find(
        (it) => !it.purchased && it.name.toLowerCase() === name.toLowerCase()
      );
      if (existing) return prev;
      return [{ id: uid(), name, purchased: false, addedAt: Date.now() }, ...prev];
    });
    setDraft("");
  }, []);

  const toggle = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, purchased: !it.purchased } : it)));
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const clearPurchased = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setItems((prev) => prev.filter((it) => !it.purchased));
  }, []);

  const { toBuy, inCart } = useMemo(() => {
    const toBuy = items.filter((it) => !it.purchased);
    const inCart = items.filter((it) => it.purchased);
    return { toBuy, inCart };
  }, [items]);

  const suggestions = QUICK_ADDS.filter(
    (s) => !items.some((it) => !it.purchased && it.name.toLowerCase() === s.toLowerCase())
  ).slice(0, 10);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.content,
            { paddingTop: topPad + 16, paddingBottom: Platform.OS === "web" ? 124 : 110 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => router.back()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="chevron-back" size={26} color={colors.foreground} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.foreground }]}>Grocery List</Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                {toBuy.length} to buy · {inCart.length} in cart
              </Text>
            </View>
            {inCart.length > 0 && (
              <TouchableOpacity onPress={clearPurchased} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={[styles.clearLink, { color: colors.primary }]}>Clear cart</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Add row */}
          <GlassCard style={styles.addCard}>
            <TextInput
              ref={inputRef}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={() => addItem(draft)}
              placeholder="Add an item…"
              placeholderTextColor={colors.mutedForeground}
              returnKeyType="done"
              style={[styles.input, { color: colors.foreground }]}
            />
            <AnimatedPressable
              onPress={() => addItem(draft)}
              style={[styles.addBtn, { backgroundColor: draft.trim() ? colors.primary : colors.muted }]}
            >
              <Ionicons
                name="add"
                size={22}
                color={draft.trim() ? colors.primaryForeground : colors.mutedForeground}
              />
            </AnimatedPressable>
          </GlassCard>

          {/* Quick adds */}
          {suggestions.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Quick add</Text>
              <View style={styles.chipsWrap}>
                {suggestions.map((s) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => addItem(s)}
                    style={[styles.chip, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <Ionicons name="add" size={14} color={colors.primary} />
                    <Text style={[styles.chipText, { color: colors.foreground }]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* To buy */}
          <Text style={[styles.sectionLabel, { color: colors.foreground, marginTop: 20 }]}>
            To buy ({toBuy.length})
          </Text>
          {toBuy.length === 0 ? (
            <GlassCard style={styles.emptyCard}>
              <Ionicons name="cart-outline" size={28} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Nothing to buy yet. Add items above or tap a quick-add.
              </Text>
            </GlassCard>
          ) : (
            toBuy.map((it) => (
              <ItemRow key={it.id} item={it} colors={colors} onToggle={toggle} onRemove={remove} />
            ))
          )}

          {/* In cart */}
          {inCart.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.foreground, marginTop: 20 }]}>
                In cart ({inCart.length})
              </Text>
              {inCart.map((it) => (
                <ItemRow key={it.id} item={it} colors={colors} onToggle={toggle} onRemove={remove} />
              ))}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function ItemRow({
  item,
  colors,
  onToggle,
  onRemove,
}: {
  item: GroceryItem;
  colors: ReturnType<typeof useColors>;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <GlassCard style={styles.itemRow}>
      <TouchableOpacity
        onPress={() => onToggle(item.id)}
        style={styles.itemMain}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      >
        <View
          style={[
            styles.checkbox,
            {
              borderColor: item.purchased ? colors.primary : colors.border,
              backgroundColor: item.purchased ? colors.primary : "transparent",
            },
          ]}
        >
          {item.purchased && (
            <Ionicons name="checkmark" size={15} color={colors.primaryForeground} />
          )}
        </View>
        <Text
          style={[
            styles.itemName,
            {
              color: item.purchased ? colors.mutedForeground : colors.foreground,
              textDecorationLine: item.purchased ? "line-through" : "none",
            },
          ]}
        >
          {item.name}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => onRemove(item.id)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="close" size={18} color={colors.mutedForeground} />
      </TouchableOpacity>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 },
  title: { fontSize: 22, fontFamily: "SpaceGrotesk_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  clearLink: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  addCard: { flexDirection: "row", alignItems: "center", gap: 10, padding: 8, paddingLeft: 14 },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", paddingVertical: 10 },
  addBtn: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },

  sectionLabel: { fontSize: 14, fontFamily: "SpaceGrotesk_600SemiBold", marginBottom: 10, marginTop: 16 },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingVertical: 7, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1,
  },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },

  emptyCard: { padding: 24, alignItems: "center", gap: 10 },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },

  itemRow: { flexDirection: "row", alignItems: "center", padding: 12, marginBottom: 8 },
  itemMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  checkbox: {
    width: 24, height: 24, borderRadius: 8, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
  itemName: { fontSize: 15, fontFamily: "Inter_500Medium", flex: 1 },
});
