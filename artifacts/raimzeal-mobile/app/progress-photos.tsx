import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { usePermissionToast } from "@/hooks/usePermissionToast";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { getApiBase } from "@/lib/db";

const STORAGE_KEY = "raimzeal_progress_photos_v2";
const OLD_STORAGE_KEY = "raimzeal_progress_photos";

type SyncStatus = "local" | "uploading" | "synced" | "error";

interface ProgressPhoto {
  id: string;
  uri: string;
  localUri?: string;
  date: string;
  takenAt?: string;
  category: "front" | "side" | "back" | "other";
  note?: string;
  storagePath?: string;
  syncStatus: SyncStatus;
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

function encodeCaptionCategory(category: ProgressPhoto["category"], note?: string): string {
  return note ? `${category}:${note}` : `${category}:`;
}

function decodeCaptionCategory(caption: string | null): { category: ProgressPhoto["category"]; note?: string } {
  if (!caption) return { category: "other" };
  const match = caption.match(/^(front|side|back|other):(.*)?$/s);
  if (!match) return { category: "other", note: caption || undefined };
  return {
    category: match[1] as ProgressPhoto["category"],
    note: match[2] ? match[2] : undefined,
  };
}

function mapServerPhoto(p: {
  id: string;
  storage_path: string;
  caption: string | null;
  weight_kg: number | null;
  body_fat_pct: number | null;
  taken_at: string;
  created_at: string;
  url: string | null;
}): ProgressPhoto {
  const { category, note } = decodeCaptionCategory(p.caption);
  return {
    id: p.id,
    uri: p.url ?? "",
    date: p.taken_at ? `${p.taken_at}T00:00:00.000Z` : p.created_at,
    takenAt: p.taken_at,
    category,
    note,
    storagePath: p.storage_path,
    syncStatus: "synced",
  };
}

export default function ProgressPhotosScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const canUploadPhotos = true;
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ProgressPhoto["category"] | "all">("all");
  const [loading, setLoading] = useState(true);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelected, setCompareSelected] = useState<ProgressPhoto[]>([]);
  const [showCompare, setShowCompare] = useState(false);

  const { showPermissionToast, permissionToastElement } = usePermissionToast();

  useFocusEffect(
    useCallback(() => {
      void loadPhotos();
    }, [session?.access_token]) // eslint-disable-line react-hooks/exhaustive-deps
  );

  async function persistPhotos(updated: ProgressPhoto[]) {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch { }
  }

  function updatePhotoById(id: string, patch: Partial<ProgressPhoto>) {
    setPhotos((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, ...patch } : p));
      void persistPhotos(next);
      return next;
    });
  }

  async function loadPhotos() {
    setLoading(true);

    // One-time migration: lift photos from the old storage key into v2 format
    try {
      const oldRaw = await AsyncStorage.getItem(OLD_STORAGE_KEY);
      if (oldRaw) {
        const oldParsed: unknown[] = JSON.parse(oldRaw);
        const migrated: ProgressPhoto[] = oldParsed.map((p: unknown) => {
          const photo = p as unknown as ProgressPhoto;
          return {
            ...photo,
            syncStatus: "local" as SyncStatus,
            localUri: photo.localUri ?? photo.uri,
          };
        });
        // Merge into v2 only if v2 is empty so we don't clobber newer data
        const existingV2 = await AsyncStorage.getItem(STORAGE_KEY);
        if (!existingV2 && migrated.length > 0) {
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        }
        await AsyncStorage.removeItem(OLD_STORAGE_KEY);
      }
    } catch { }

    let localPhotos: ProgressPhoto[] = [];
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown[] = JSON.parse(raw);
        localPhotos = parsed.map((p: unknown) => {
          const photo = p as unknown as ProgressPhoto;
          // Stale "uploading" means the app crashed mid-upload — treat as retryable error
          const status: SyncStatus =
            !photo.syncStatus || photo.syncStatus === "uploading"
              ? "error"
              : photo.syncStatus;
          return { ...photo, syncStatus: status, localUri: photo.localUri ?? photo.uri };
        });
      }
    } catch { }

    if (!session?.access_token) {
      setPhotos(localPhotos);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${getApiBase()}/user/progress-photos`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json() as { photos: Parameters<typeof mapServerPhoto>[0][] };
      const serverPhotos = body.photos.map(mapServerPhoto);

      // Keep only truly unsynced locals (not yet on server)
      const pendingLocals = localPhotos.filter(
        (lp) =>
          lp.syncStatus === "error" ||
          lp.syncStatus === "local" ||
          (lp.syncStatus === "uploading" &&
            !serverPhotos.some((sp) => sp.storagePath === lp.storagePath))
      );

      // Automatically queue pending locals for upload
      const toUpload = pendingLocals.filter((p) => !!p.localUri);
      const readyLocals = pendingLocals.map((p) =>
        toUpload.some((u) => u.id === p.id)
          ? { ...p, syncStatus: "uploading" as SyncStatus }
          : p
      );

      const merged = [...readyLocals, ...serverPhotos].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setPhotos(merged);
      void persistPhotos(merged);

      // Fire off background uploads for any pending local/error photos
      if (toUpload.length > 0) {
        toUpload.forEach((p) => {
          void uploadPhoto(p.id, p.localUri!, p.category, p.note);
        });
      }
    } catch {
      setPhotos(localPhotos);
    } finally {
      setLoading(false);
    }
  }

  async function uploadPhoto(tempId: string, localUri: string, category: ProgressPhoto["category"], note: string | undefined) {
    if (!session?.access_token) {
      updatePhotoById(tempId, { syncStatus: "local" });
      return;
    }

    const ext = localUri.split(".").pop()?.toLowerCase() ?? "jpg";
    const contentType =
      ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    const filename = `progress_${Date.now()}.${ext}`;

    try {
      const urlRes = await fetch(`${getApiBase()}/user/progress-photos/upload-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ filename, contentType }),
      });
      if (!urlRes.ok) throw new Error(`URL ${urlRes.status}`);
      const { uploadUrl, storagePath } = await urlRes.json() as { uploadUrl: string; storagePath: string; token: string };

      const fileRes = await fetch(localUri);
      const blob = await fileRes.blob();
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: blob,
      });
      if (!putRes.ok) throw new Error(`PUT ${putRes.status}`);

      const recordRes = await fetch(`${getApiBase()}/user/progress-photos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          storage_path: storagePath,
          caption: encodeCaptionCategory(category, note),
          taken_at: new Date().toISOString().split("T")[0],
        }),
      });
      if (!recordRes.ok) throw new Error(`Record ${recordRes.status}`);
      const { photo: serverPhoto } = await recordRes.json() as { photo: { id: string } };

      updatePhotoById(tempId, {
        id: serverPhoto.id,
        storagePath,
        syncStatus: "synced",
      });
    } catch {
      updatePhotoById(tempId, { syncStatus: "error" });
    }
  }

  async function retryUpload(photo: ProgressPhoto) {
    if (!photo.localUri) return;
    updatePhotoById(photo.id, { syncStatus: "uploading" });
    await uploadPhoto(photo.id, photo.localUri, photo.category, photo.note);
  }

  async function addPhotoFromAsset(localUri: string) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const category = await pickCategory();
    if (!category) return;

    const tempId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date();
    const pendingPhoto: ProgressPhoto = {
      id: tempId,
      uri: localUri,
      localUri,
      date: now.toISOString(),
      takenAt: now.toISOString().split("T")[0],
      category,
      syncStatus: session?.access_token ? "uploading" : "local",
    };

    setPhotos((prev) => {
      const next = [pendingPhoto, ...prev];
      void persistPhotos(next);
      return next;
    });

    if (session?.access_token) {
      await uploadPhoto(tempId, localUri, category, undefined);
    }
  }

  async function handleAddPhoto() {
    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        showPermissionToast("Photo access blocked — tap to open Settings");
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;
    await addPhotoFromAsset(result.assets[0].uri);
  }

  async function handleTakePhoto() {
    if (Platform.OS === "web") {
      Alert.alert("Camera", "Camera capture is only available in the native app. Use 'Choose from Library' to upload a photo.");
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      showPermissionToast("Camera access blocked — tap to open Settings");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;
    await addPhotoFromAsset(result.assets[0].uri);
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

  function handleDeletePhoto(photo: ProgressPhoto) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      "Delete Photo",
      "Are you sure you want to delete this progress photo? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const withoutPhoto = photos.filter((p) => p.id !== photo.id);
            setPhotos(withoutPhoto);
            void persistPhotos(withoutPhoto);

            if (photo.syncStatus === "synced" && session?.access_token) {
              try {
                await fetch(`${getApiBase()}/user/progress-photos/${encodeURIComponent(photo.id)}`, {
                  method: "DELETE",
                  headers: { Authorization: `Bearer ${session.access_token}` },
                });
              } catch { }
            }
          },
        },
      ]
    );
  }

  const filtered = selectedCategory === "all"
    ? photos
    : photos.filter((p) => p.category === selectedCategory);

  const categoryCount = (cat: ProgressPhoto["category"] | "all") =>
    cat === "all" ? photos.length : photos.filter((p) => p.category === cat).length;

  const pendingCount = photos.filter((p) => p.syncStatus === "uploading").length;
  const errorCount = photos.filter((p) => p.syncStatus === "error").length;

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
            {photos.length} photo{photos.length !== 1 ? "s" : ""}
            {pendingCount > 0 ? ` · ${pendingCount} uploading` : ""}
            {errorCount > 0 ? ` · ${errorCount} failed` : ""}
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {photos.filter((p) => p.syncStatus === "synced").length >= 2 && (
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                if (compareMode) {
                  setCompareMode(false);
                  setCompareSelected([]);
                } else {
                  setCompareMode(true);
                  setCompareSelected([]);
                }
              }}
              style={[
                styles.addBtn,
                {
                  backgroundColor: compareMode ? colors.secondary + "30" : colors.muted,
                  borderWidth: compareMode ? 1 : 0,
                  borderColor: colors.secondary,
                },
              ]}
            >
              <Ionicons
                name="git-compare-outline"
                size={18}
                color={compareMode ? colors.secondary : colors.mutedForeground}
              />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              Alert.alert(
                "Add Photo",
                "Choose a source",
                [
                  { text: "Take Photo", onPress: () => void handleTakePhoto() },
                  { text: "Choose from Library", onPress: () => void handleAddPhoto() },
                  { text: "Cancel", style: "cancel" },
                ]
              );
            }}
            style={[styles.addBtn, { backgroundColor: canUploadPhotos ? colors.primary : colors.mutedForeground }]}
          >
            <Ionicons name={canUploadPhotos ? "add" : "lock-closed-outline"} size={20} color={colors.primaryForeground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Upload error banner */}
      {errorCount > 0 && (
        <View style={[styles.errorBanner, { backgroundColor: colors.destructive + "15", borderColor: colors.destructive + "40" }]}>
          <Ionicons name="cloud-offline-outline" size={16} color={colors.destructive} />
          <Text style={[styles.errorBannerText, { color: colors.destructive }]}>
            {errorCount} photo{errorCount !== 1 ? "s" : ""} failed to upload — tap the retry button to try again
          </Text>
        </View>
      )}

      {/* Compare mode action bar */}
      {compareMode && (
        <View style={[styles.compareBanner, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Text style={[styles.compareBannerText, { color: colors.foreground }]}>
            {compareSelected.length === 0
              ? "Tap 2 photos to compare"
              : compareSelected.length === 1
              ? "Select one more photo"
              : "Ready to compare"}
          </Text>
          {compareSelected.length === 2 && (
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowCompare(true);
              }}
              style={[styles.compareBtn, { backgroundColor: colors.secondary }]}
            >
              <Text style={[styles.compareBtnText, { color: "#fff" }]}>Compare</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

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
      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
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
                { text: "Take Photo", onPress: () => void handleTakePhoto() },
                { text: "Choose from Library", onPress: () => void handleAddPhoto() },
                { text: "Cancel", style: "cancel" },
              ]);
            }}
            style={[styles.emptyBtn, { backgroundColor: canUploadPhotos ? colors.primary : colors.mutedForeground }]}
          >
            <Ionicons name={canUploadPhotos ? "camera-outline" : "lock-closed-outline"} size={18} color={colors.primaryForeground} />
            <Text style={[styles.emptyBtnText, { color: colors.primaryForeground }]}>
              {canUploadPhotos ? "Add First Photo" : "Rise+ Required"}
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
          renderItem={({ item }) => {
            const isSelected = compareSelected.some((p) => p.id === item.id);
            const isUploading = item.syncStatus === "uploading";
            const isError = item.syncStatus === "error";
            const isLocal = item.syncStatus === "local";

            return (
              <TouchableOpacity
                activeOpacity={compareMode ? 0.7 : 1}
                onPress={() => {
                  if (!compareMode) return;
                  if (item.syncStatus !== "synced") return;
                  if (isSelected) {
                    setCompareSelected((prev) => prev.filter((p) => p.id !== item.id));
                  } else if (compareSelected.length < 2) {
                    Haptics.selectionAsync();
                    setCompareSelected((prev) => [...prev, item]);
                  }
                }}
                onLongPress={() => {
                  if (!compareMode) handleDeletePhoto(item);
                }}
                style={[
                  styles.photoCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: isError
                      ? colors.destructive + "80"
                      : isSelected
                      ? colors.secondary
                      : colors.border,
                    borderWidth: isError || isSelected ? 2 : 1,
                    opacity: isUploading ? 0.8 : 1,
                  },
                ]}
              >
                <Image source={{ uri: item.uri }} style={styles.photoImage} resizeMode="cover" />

                {/* Uploading overlay */}
                {isUploading && (
                  <View style={styles.uploadingOverlay}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.uploadingText}>Uploading…</Text>
                  </View>
                )}

                {/* Error overlay with retry */}
                {isError && (
                  <View style={styles.errorOverlay}>
                    <Ionicons name="cloud-offline-outline" size={20} color="#fff" />
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        void retryUpload(item);
                      }}
                      style={styles.retryBtn}
                    >
                      <Text style={styles.retryText}>Retry</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Local (no auth) badge */}
                {isLocal && (
                  <View style={[styles.localBadge, { backgroundColor: colors.muted }]}>
                    <Ionicons name="phone-portrait-outline" size={10} color={colors.mutedForeground} />
                  </View>
                )}

                {/* Compare selection overlay */}
                {isSelected && (
                  <View style={styles.selectedOverlay}>
                    <Ionicons name="checkmark-circle" size={28} color={colors.secondary} />
                  </View>
                )}

                <View style={[styles.photoCategoryBadge, { backgroundColor: "#8B31C7CC" }]}>
                  <Text style={styles.photoCategoryText}>
                    {CATEGORIES.find((c) => c.key === item.category)?.label ?? item.category}
                  </Text>
                </View>
                <View style={styles.photoFooter}>
                  <Text style={[styles.photoDate, { color: colors.mutedForeground }]}>
                    {formatDate(item.date)}
                  </Text>
                  {!compareMode && !isUploading && (
                    <TouchableOpacity
                      onPress={() => handleDeletePhoto(item)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.destructive} />
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Tips banner */}
      {photos.length > 0 && !compareMode && !loading && (
        <View style={[styles.tipBanner, { backgroundColor: "#8B31C7" + "10", borderColor: "#8B31C7" + "30" }]}>
          <Ionicons name="bulb-outline" size={16} color="#8B31C7" />
          <Text style={[styles.tipText, { color: colors.mutedForeground }]}>
            Take photos every 2–4 weeks, same time of day, same lighting for best comparisons.
          </Text>
        </View>
      )}

      {permissionToastElement}

      {/* Before/After Comparison Modal */}
      {showCompare && compareSelected.length === 2 && (
        <View
          style={[
            styles.compareModal,
            { backgroundColor: colors.background },
          ]}
        >
          <View style={[styles.compareModalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.compareModalTitle, { color: colors.foreground }]}>
              Before / After
            </Text>
            <TouchableOpacity
              onPress={() => setShowCompare(false)}
              hitSlop={10}
              style={[styles.compareCloseBtn, { backgroundColor: colors.muted }]}
            >
              <Ionicons name="close" size={20} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <View style={styles.compareRow}>
            {compareSelected.map((photo, i) => (
              <View key={photo.id} style={styles.comparePhotoWrap}>
                <View style={[styles.compareLabelBadge, { backgroundColor: i === 0 ? "#8B31C7CC" : "#C9A84CCC" }]}>
                  <Text style={styles.compareLabelText}>{i === 0 ? "Before" : "After"}</Text>
                </View>
                <Image source={{ uri: photo.uri }} style={styles.comparePhoto} resizeMode="cover" />
                <Text style={[styles.compareDate, { color: colors.mutedForeground }]}>
                  {formatDate(photo.date)}
                </Text>
              </View>
            ))}
          </View>
          {(() => {
            const d1 = new Date(compareSelected[0].date);
            const d2 = new Date(compareSelected[1].date);
            const diffDays = Math.abs(Math.round((d2.getTime() - d1.getTime()) / 86400000));
            const weeks = Math.floor(diffDays / 7);
            const span = weeks > 0 ? `${weeks} week${weeks !== 1 ? "s" : ""}` : `${diffDays} day${diffDays !== 1 ? "s" : ""}`;
            return (
              <View style={[styles.compareSpan, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="time-outline" size={14} color={colors.mutedForeground} />
                <Text style={[styles.compareSpanText, { color: colors.mutedForeground }]}>
                  {span} between photos
                </Text>
              </View>
            );
          })()}
          <TouchableOpacity
            onPress={() => {
              setShowCompare(false);
              setCompareMode(false);
              setCompareSelected([]);
            }}
            style={[styles.compareDoneBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.compareDoneBtnText, { color: colors.primaryForeground }]}>Done</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const { width: SCREEN_W } = Dimensions.get("window");
const PHOTO_SIZE = (SCREEN_W - 12 * 2 - 8) / 2;

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
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  errorBannerText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium" },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: "center",
  },
  filterChipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  grid: { padding: 12, gap: 8 },
  row: { gap: 8 },
  photoCard: {
    width: PHOTO_SIZE,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  photoImage: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE * 1.25,
  },
  uploadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  uploadingText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  errorOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(180,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  retryBtn: {
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
  },
  retryText: {
    color: "#b00",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  localBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
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
  selectedOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
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
  compareBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 12,
  },
  compareBannerText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  compareBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20 },
  compareBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  compareModal: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  compareModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  compareModalTitle: { flex: 1, fontSize: 22, fontFamily: "SpaceGrotesk_700Bold" },
  compareCloseBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  compareRow: { flex: 1, flexDirection: "row", gap: 8, padding: 12 },
  comparePhotoWrap: { flex: 1, gap: 6, alignItems: "center" },
  compareLabelBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, alignSelf: "stretch", alignItems: "center" },
  compareLabelText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" },
  comparePhoto: { width: "100%", flex: 1, borderRadius: 12 },
  compareDate: { fontSize: 11, fontFamily: "Inter_400Regular" },
  compareSpan: { flexDirection: "row", alignItems: "center", gap: 6, margin: 12, padding: 10, borderRadius: 10, borderWidth: 1, justifyContent: "center" },
  compareSpanText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  compareDoneBtn: { margin: 16, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  compareDoneBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
