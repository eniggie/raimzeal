import React, { useState, useCallback } from "react";
import {
  Alert,
  FlatList,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useFocusEffect } from "expo-router";

const STORAGE_KEY = "raimzeal_progress_photos";

interface ProgressPhoto {
  id: string;
  uri: string;
  date: string;
  note?: string;
  category: "front" | "side" | "back" | "other";
}

const CATEGORIES: Array<{ key: ProgressPhoto["category"]; label: string; icon: string }> = [
  { key: "front", label: "Front", icon: "person-outline" },
  { key: "side", label: "Side", icon: "body-outline" },
  { key: "back", label: "Back", icon: "arrow-back-outline" },
  { key: "other", label: "Other", icon: "image-outline" },
];

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ProgressPhotosScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ProgressPhoto["category"] | "all">("all");
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadPhotos();
    }, [])
  );

  async function loadPhotos() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) setPhotos(JSON.parse(raw));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function savePhotos(updated: ProgressPhoto[]) {
    setPhotos(updated);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  }

  async function handleAddPhoto() {
    if (Platform.OS === "web") {
      Alert.alert("Progress Photos", "Photo upload is available on the mobile app. Download RAIMZEAL to track your visual transformation.");
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "RAIMZEAL needs access to your photo library to add progress photos.",
        [{ text: "OK" }]
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const category = await pickCategory();
    if (!category) return;

    const newPhoto: ProgressPhoto = {
      id: `photo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      uri: result.assets[0].uri,
      date: new Date().toISOString(),
      category,
    };

    await savePhotos([newPhoto, ...photos]);
  }

  async function handleTakePhoto() {
    if (Platform.OS === "web") {
      Alert.alert("Progress Photos", "Camera capture is available on the mobile app.");
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "RAIMZEAL needs camera access to take progress photos.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const category = await pickCategory();
    if (!category) return;

    const newPhoto: ProgressPhoto = {
      id: `photo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      uri: result.assets[0].uri,
      date: new Date().toISOString(),
      category,
    };

    await savePhotos([newPhoto, ...photos]);
  }

  function pickCategory(): Promise<ProgressPhoto["category"] | null> {
    return new Promise((resolve) => {
      Alert.alert(
        "Select Category",
        "Which angle is this photo?",
        [
          { text: "Front", onPress: () => resolve("front") },
          { text: "Side", onPress: () => resolve("side") },
          { text: "Back", onPress: () => resolve("back") },
          { text: "Other", onPress: () => resolve("other") },
          { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
        ]
      );
    });
  }

  function handleDeletePhoto(id: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      "Delete Photo",
      "Are you sure you want to delete this progress photo? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => savePhotos(photos.filter((p) => p.id !== id)),
        },
      ]
    );
  }

  const filtered = selectedCategory === "all"
    ? photos
    : photos.filter((p) => p.category === selectedCategory);

  const categoryCount = (cat: ProgressPhoto["category"] | "all") =>
    cat === "all" ? photos.length : photos.filter((p) => p.category === cat).length;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 12,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={[styles.headerTitleText, { color: colors.foreground }]}>
            Progress Photos
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>
            {photos.length} photo{photos.length !== 1 ? "s" : ""} saved
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Alert.alert(
              "Add Photo",
              "Choose a source",
              [
                { text: "Take Photo", onPress: handleTakePhoto },
                { text: "Choose from Library", onPress: handleAddPhoto },
                { text: "Cancel", style: "cancel" },
              ]
            );
          }}
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
        >
          <Ionicons name="add" size={20} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>

      {/* Category filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        <TouchableOpacity
          onPress={() => { Haptics.selectionAsync(); setSelectedCategory("all"); }}
          style={[
            styles.filterChip,
            {
              backgroundColor: selectedCategory === "all" ? colors.primary : colors.muted,
              borderColor: selectedCategory === "all" ? colors.primary : colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.filterChipText,
              { color: selectedCategory === "all" ? colors.primaryForeground : colors.mutedForeground },
            ]}
          >
            All ({categoryCount("all")})
          </Text>
        </TouchableOpacity>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.key}
            onPress={() => { Haptics.selectionAsync(); setSelectedCategory(cat.key); }}
            style={[
              styles.filterChip,
              {
                backgroundColor: selectedCategory === cat.key ? colors.primary : colors.muted,
                borderColor: selectedCategory === cat.key ? colors.primary : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                { color: selectedCategory === cat.key ? colors.primaryForeground : colors.mutedForeground },
              ]}
            >
              {cat.label} ({categoryCount(cat.key)})
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Photo grid */}
      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIcon, { backgroundColor: "#8B31C7" + "15" }]}>
            <Ionicons name="camera-outline" size={48} color="#8B31C7" />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            No progress photos yet
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            Add your first photo to start tracking your visual transformation. Taking photos every 2–4 weeks gives the best comparison.
          </Text>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              Alert.alert("Add Photo", "Choose a source", [
                { text: "Take Photo", onPress: handleTakePhoto },
                { text: "Choose from Library", onPress: handleAddPhoto },
                { text: "Cancel", style: "cancel" },
              ]);
            }}
            style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
          >
            <Ionicons name="camera-outline" size={18} color={colors.primaryForeground} />
            <Text style={[styles.emptyBtnText, { color: colors.primaryForeground }]}>
              Add First Photo
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={[
            styles.grid,
            { paddingBottom: Platform.OS === "web" ? 34 + 84 : 100 },
          ]}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => (
            <View style={[styles.photoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Image source={{ uri: item.uri }} style={styles.photoImage} resizeMode="cover" />
              <View style={[styles.photoCategoryBadge, { backgroundColor: "#8B31C7" + "CC" }]}>
                <Text style={styles.photoCategoryText}>
                  {CATEGORIES.find((c) => c.key === item.category)?.label ?? item.category}
                </Text>
              </View>
              <View style={styles.photoFooter}>
                <Text style={[styles.photoDate, { color: colors.mutedForeground }]}>
                  {formatDate(item.date)}
                </Text>
                <TouchableOpacity
                  onPress={() => handleDeletePhoto(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.destructive} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* Tips banner */}
      {photos.length > 0 && (
        <View style={[styles.tipBanner, { backgroundColor: "#8B31C7" + "10", borderColor: "#8B31C7" + "30" }]}>
          <Ionicons name="bulb-outline" size={16} color="#8B31C7" />
          <Text style={[styles.tipText, { color: colors.mutedForeground }]}>
            Take photos every 2–4 weeks, same time of day, same lighting for best comparisons.
          </Text>
        </View>
      )}
    </View>
  );
}

const PHOTO_SIZE = (340) / 2 - 6;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { flex: 1, gap: 1 },
  headerTitleText: { fontSize: 20, fontFamily: "SpaceGrotesk_700Bold" },
  headerSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular" },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  grid: { padding: 12, gap: 8 },
  row: { gap: 8 },
  photoCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  photoImage: {
    width: "100%",
    height: PHOTO_SIZE,
  },
  photoCategoryBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  photoCategoryText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#fff" },
  photoFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 10,
  },
  photoDate: { fontSize: 11, fontFamily: "Inter_400Regular" },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 20, fontFamily: "SpaceGrotesk_700Bold", textAlign: "center" },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 8,
  },
  emptyBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  tipBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    margin: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  tipText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
});
