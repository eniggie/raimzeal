import React, { useCallback, useEffect, useState } from "react";
import {
  Dimensions,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Reanimated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useReduceMotion } from "@/hooks/useReduceMotion";

import ShareProgressCard, {
  CARD_WIDTH,
  ShareProgressCardProps,
} from "@/components/ShareProgressCard";

const OVERLAY_PREF_KEY = "cropCardOverlayVisible";

export interface CropData {
  scale: number;
  panX: number;
  panY: number;
}

interface Props {
  visible: boolean;
  photoUri: string | null;
  initialCrop?: CropData;
  onConfirm: (crop: CropData) => void;
  onCancel: () => void;
  /**
   * When provided, a translucent ShareProgressCard is overlaid on the crop
   * frame so users can see if their subject is hidden behind card content.
   * backgroundPhotoUri / backgroundPhotoCrop / backgroundPhotoDimLevel are
   * intentionally ignored — the image being cropped fills that role.
   */
  cardOverlay?: ShareProgressCardProps;
}

const CROP_ASPECT = 1.4;
const CROP_FRAME_HEIGHT = Math.round(CARD_WIDTH * CROP_ASPECT);

function clamp(val: number, min: number, max: number) {
  "worklet";
  return Math.min(max, Math.max(min, val));
}

function panBounds(scale: number): { maxX: number; maxY: number } {
  "worklet";
  return {
    maxX: (CARD_WIDTH * (scale - 1)) / 2,
    maxY: (CROP_FRAME_HEIGHT * (scale - 1)) / 2,
  };
}

export default function CropPhotoModal({
  visible,
  photoUri,
  initialCrop,
  onConfirm,
  onCancel,
  cardOverlay,
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const [showCardOverlay, setShowCardOverlay] = useState(true);

  const screenW = Dimensions.get("window").width;

  const displayScale = Math.min(1, (screenW - 32) / CARD_WIDTH);
  const frameW = CARD_WIDTH * displayScale;
  const frameH = CROP_FRAME_HEIGHT * displayScale;

  const cropScale = useSharedValue(1);
  const savedCropScale = useSharedValue(1);
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const savedPanX = useSharedValue(0);
  const savedPanY = useSharedValue(0);
  const overlayOpacity = useSharedValue(1);

  useEffect(() => {
    AsyncStorage.getItem(OVERLAY_PREF_KEY).then((stored) => {
      if (stored !== null) {
        const saved = stored !== "false";
        setShowCardOverlay(saved);
        overlayOpacity.value = saved ? 1 : 0;
      }
    });
  }, []);

  useEffect(() => {
    if (visible) {
      const sc = initialCrop?.scale ?? 1;
      const px = initialCrop?.panX ?? 0;
      const py = initialCrop?.panY ?? 0;
      cropScale.value = sc;
      savedCropScale.value = sc;
      panX.value = px;
      panY.value = py;
      savedPanX.value = px;
      savedPanY.value = py;
    }
  }, [visible, initialCrop]);

  const handleConfirm = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onConfirm({ scale: cropScale.value, panX: panX.value, panY: panY.value });
  }, [onConfirm, cropScale, panX, panY]);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      "worklet";
      const next = clamp(savedCropScale.value * e.scale, 1, 5);
      cropScale.value = next;
      const { maxX, maxY } = panBounds(next);
      panX.value = clamp(panX.value, -maxX, maxX);
      panY.value = clamp(panY.value, -maxY, maxY);
    })
    .onEnd(() => {
      "worklet";
      savedCropScale.value = cropScale.value;
      savedPanX.value = panX.value;
      savedPanY.value = panY.value;
    });

  const panGesture = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      "worklet";
      const { maxX, maxY } = panBounds(cropScale.value);
      panX.value = clamp(savedPanX.value + e.translationX / displayScale, -maxX, maxX);
      panY.value = clamp(savedPanY.value + e.translationY / displayScale, -maxY, maxY);
    })
    .onEnd(() => {
      "worklet";
      savedPanX.value = panX.value;
      savedPanY.value = panY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      "worklet";
      if (reduceMotion) {
        cropScale.value = 1;
        panX.value = 0;
        panY.value = 0;
      } else {
        cropScale.value = withSpring(1, { damping: 14, stiffness: 200 });
        panX.value = withSpring(0, { damping: 14, stiffness: 200 });
        panY.value = withSpring(0, { damping: 14, stiffness: 200 });
      }
      savedCropScale.value = 1;
      savedPanX.value = 0;
      savedPanY.value = 0;
    });

  const composed = Gesture.Simultaneous(
    Gesture.Race(doubleTap, panGesture),
    pinchGesture
  );

  const imageAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: cropScale.value },
      { translateX: panX.value * displayScale },
      { translateY: panY.value * displayScale },
    ],
  }));

  const overlayAnimStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const handleToggleOverlay = useCallback(() => {
    const next = !showCardOverlay;
    setShowCardOverlay(next);
    overlayOpacity.value = reduceMotion
      ? next ? 1 : 0
      : withTiming(next ? 1 : 0, { duration: 175 });
    AsyncStorage.setItem(OVERLAY_PREF_KEY, String(next));
  }, [showCardOverlay, overlayOpacity, reduceMotion]);

  if (!photoUri) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
    >
      <SafeAreaView style={styles.root}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top > 0 ? 0 : 12 }]}>
          <TouchableOpacity
            onPress={onCancel}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.headerBtn}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Position Photo</Text>
          <TouchableOpacity
            onPress={handleConfirm}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.headerBtn}
          >
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Hint */}
        <Text style={styles.hint}>Pinch to zoom · Drag to reposition · Double-tap to reset</Text>

        {/* Crop area */}
        <View style={styles.cropArea}>
          <GestureDetector gesture={composed}>
            <View
              style={[
                styles.frame,
                { width: frameW, height: frameH, borderRadius: 16 * displayScale },
              ]}
            >
              <Reanimated.Image
                source={{ uri: photoUri }}
                style={[
                  StyleSheet.absoluteFillObject,
                  { borderRadius: 16 * displayScale },
                  imageAnimStyle,
                ]}
                resizeMode="cover"
              />
              {/* Live card overlay */}
              {cardOverlay && (
                <Reanimated.View
                  style={[StyleSheet.absoluteFillObject, overlayAnimStyle]}
                  pointerEvents="none"
                >
                  <View style={styles.cardOverlayWrap}>
                    <ShareProgressCard
                      {...cardOverlay}
                      backgroundPhotoUri={undefined}
                      backgroundPhotoCrop={undefined}
                      backgroundPhotoDimLevel={undefined}
                      renderScale={displayScale}
                    />
                  </View>
                </Reanimated.View>
              )}
              {/* Corner markers */}
              <View style={[styles.cornerTL, styles.cornerH]} />
              <View style={[styles.cornerTL, styles.cornerV]} />
              <View style={[styles.cornerTR, styles.cornerH]} />
              <View style={[styles.cornerTR, styles.cornerV]} />
              <View style={[styles.cornerBL, styles.cornerH]} />
              <View style={[styles.cornerBL, styles.cornerV]} />
              <View style={[styles.cornerBR, styles.cornerH]} />
              <View style={[styles.cornerBR, styles.cornerV]} />
            </View>
          </GestureDetector>
        </View>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          {cardOverlay && (
            <TouchableOpacity
              onPress={handleToggleOverlay}
              activeOpacity={0.75}
              style={[
                styles.overlayToggleBtn,
                !showCardOverlay && styles.overlayToggleBtnActive,
              ]}
            >
              <Ionicons
                name={showCardOverlay ? "eye-off-outline" : "eye-outline"}
                size={17}
                color={
                  showCardOverlay
                    ? "rgba(255,255,255,0.70)"
                    : "rgba(255,255,255,0.92)"
                }
              />
              <Text
                style={[
                  styles.overlayToggleText,
                  !showCardOverlay && styles.overlayToggleTextActive,
                ]}
              >
                {showCardOverlay ? "Hide card overlay" : "Show card overlay"}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={handleConfirm}
            activeOpacity={0.85}
            style={styles.usePhotoBtn}
          >
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.usePhotoBtnText}>Use Photo</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const CORNER_SIZE = 22;
const CORNER_THICKNESS = 3;
const CORNER_COLOR = "rgba(255,255,255,0.90)";

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerBtn: {
    minWidth: 64,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
    textAlign: "center",
  },
  cancelText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.65)",
  },
  doneText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
    textAlign: "right",
  },
  hint: {
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.45)",
    marginBottom: 20,
    paddingHorizontal: 24,
  },
  cropArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  frame: {
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.25)",
  },
  footer: {
    alignItems: "center",
    paddingTop: 20,
    gap: 14,
  },
  overlayToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  overlayToggleText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.60)",
  },
  overlayToggleBtnActive: {
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.28)",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  overlayToggleTextActive: {
    color: "rgba(255,255,255,0.85)",
  },
  cardOverlayWrap: {
    opacity: 0.72,
  },
  usePhotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#2E8B57",
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 32,
  },
  usePhotoBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  cornerTL: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: CORNER_COLOR,
  },
  cornerTR: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: CORNER_COLOR,
  },
  cornerBL: {
    position: "absolute",
    bottom: 10,
    left: 10,
    backgroundColor: CORNER_COLOR,
  },
  cornerBR: {
    position: "absolute",
    bottom: 10,
    right: 10,
    backgroundColor: CORNER_COLOR,
  },
  cornerH: {
    width: CORNER_SIZE,
    height: CORNER_THICKNESS,
    borderRadius: 2,
  },
  cornerV: {
    width: CORNER_THICKNESS,
    height: CORNER_SIZE,
    borderRadius: 2,
  },
});
