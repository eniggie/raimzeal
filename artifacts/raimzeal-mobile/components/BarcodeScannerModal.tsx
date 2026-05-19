import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface ScannedFood {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingLabel?: string;
}

interface OpenFoodFactsProduct {
  product_name?: string;
  serving_size?: string;
  serving_quantity?: number;
  nutriments?: {
    "energy-kcal_100g"?: number;
    "energy-kcal_serving"?: number;
    "energy-kcal"?: number;
    proteins_100g?: number;
    proteins_serving?: number;
    proteins?: number;
    carbohydrates_100g?: number;
    carbohydrates_serving?: number;
    carbohydrates?: number;
    fat_100g?: number;
    fat_serving?: number;
    fat?: number;
  };
}

interface OpenFoodFactsResponse {
  status: number;
  product?: OpenFoodFactsProduct;
}

async function fetchFoodByBarcode(barcode: string): Promise<ScannedFood | null> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`
    );
    if (!res.ok) return null;
    const data: OpenFoodFactsResponse = await res.json();
    if (data.status !== 1 || !data.product) return null;

    const p = data.product;
    const n = p.nutriments ?? {};
    const name = p.product_name?.trim();
    if (!name) return null;

    const servingSize = p.serving_size?.trim();
    const hasAnyServingNutrient =
      n["energy-kcal_serving"] !== undefined ||
      n.proteins_serving !== undefined ||
      n.carbohydrates_serving !== undefined ||
      n.fat_serving !== undefined;
    const useServingNutrients = !!(servingSize && hasAnyServingNutrient);
    const useServingQuantity = !!(servingSize && p.serving_quantity && !hasAnyServingNutrient);
    const servingLabel = useServingNutrients || useServingQuantity ? servingSize : undefined;
    const sqFactor = p.serving_quantity ? p.serving_quantity / 100 : 1;

    const calories = useServingNutrients
      ? Math.round(n["energy-kcal_serving"] ?? n["energy-kcal_100g"] ?? n["energy-kcal"] ?? 0)
      : useServingQuantity
      ? Math.round((n["energy-kcal_100g"] ?? n["energy-kcal"] ?? 0) * sqFactor)
      : Math.round(n["energy-kcal_100g"] ?? n["energy-kcal"] ?? 0);
    const protein = useServingNutrients
      ? Math.round((n.proteins_serving ?? n.proteins_100g ?? n.proteins ?? 0) * 10) / 10
      : useServingQuantity
      ? Math.round((n.proteins_100g ?? n.proteins ?? 0) * sqFactor * 10) / 10
      : Math.round((n.proteins_100g ?? n.proteins ?? 0) * 10) / 10;
    const carbs = useServingNutrients
      ? Math.round((n.carbohydrates_serving ?? n.carbohydrates_100g ?? n.carbohydrates ?? 0) * 10) / 10
      : useServingQuantity
      ? Math.round((n.carbohydrates_100g ?? n.carbohydrates ?? 0) * sqFactor * 10) / 10
      : Math.round((n.carbohydrates_100g ?? n.carbohydrates ?? 0) * 10) / 10;
    const fat = useServingNutrients
      ? Math.round((n.fat_serving ?? n.fat_100g ?? n.fat ?? 0) * 10) / 10
      : useServingQuantity
      ? Math.round((n.fat_100g ?? n.fat ?? 0) * sqFactor * 10) / 10
      : Math.round((n.fat_100g ?? n.fat ?? 0) * 10) / 10;

    return { name, calories, protein, carbs, fat, servingLabel };
  } catch {
    return null;
  }
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onFoodFound: (food: ScannedFood) => void;
  onManualEntry: () => void;
}

export function BarcodeScannerModal({ visible, onClose, onFoodFound, onManualEntry }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBarcodeScanned = useCallback(
    async ({ data }: { data: string }) => {
      if (!scanning || loading) return;
      setScanning(false);
      setLoading(true);
      setError(null);

      const food = await fetchFoodByBarcode(data);
      setLoading(false);

      if (food) {
        onFoodFound(food);
        onClose();
      } else {
        setError("Product not found in our database.");
        setScanning(false);
      }
    },
    [scanning, loading, onFoodFound, onClose]
  );

  function handleRetry() {
    setError(null);
    setScanning(true);
  }

  function handleClose() {
    setScanning(true);
    setLoading(false);
    setError(null);
    onClose();
  }

  function handleManualEntry() {
    setScanning(true);
    setLoading(false);
    setError(null);
    onClose();
    onManualEntry();
  }

  if (Platform.OS === "web") {
    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
        <View style={styles.overlayCenter}>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.webUnsupported}>
              <Ionicons name="camera-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.webTitle, { color: colors.foreground }]}>
                Camera not available on web
              </Text>
              <Text style={[styles.webSubtitle, { color: colors.mutedForeground }]}>
                Use the mobile app to scan barcodes.
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleManualEntry}
              style={[styles.closeBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.closeBtnText, { color: colors.primaryForeground }]}>
                Enter Manually
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleClose} style={styles.cancelLink}>
              <Text style={[styles.cancelLinkText, { color: colors.mutedForeground }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={handleClose}>
      <View style={[styles.fullscreen, { backgroundColor: "#000" }]}>
        {/* Permission not yet loaded */}
        {!permission && (
          <View style={styles.centeredContent}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        )}

        {/* Permission denied */}
        {permission && !permission.granted && (
          <View style={[styles.centeredContent, { backgroundColor: colors.background }]}>
            <Ionicons name="camera-outline" size={56} color={colors.mutedForeground} />
            <Text style={[styles.permTitle, { color: colors.foreground }]}>
              Camera access needed
            </Text>
            <Text style={[styles.permSubtitle, { color: colors.mutedForeground }]}>
              Allow camera access to scan food barcodes instantly.
            </Text>
            {permission.canAskAgain ? (
              <TouchableOpacity
                onPress={requestPermission}
                style={[styles.permBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.permBtnText, { color: colors.primaryForeground }]}>
                  Allow Camera
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={[styles.permDenied, { color: colors.mutedForeground }]}>
                Camera access was denied. Please enable it in Settings to use the scanner.
              </Text>
            )}
            <TouchableOpacity onPress={handleManualEntry} style={[styles.permBtn, { backgroundColor: colors.muted, marginTop: 0 }]}>
              <Text style={[styles.permBtnText, { color: colors.foreground }]}>
                Enter Food Manually
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleClose} style={styles.cancelLink}>
              <Text style={[styles.cancelLinkText, { color: colors.mutedForeground }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Camera + scanning UI */}
        {permission && permission.granted && (
          <>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"] }}
              onBarcodeScanned={scanning ? handleBarcodeScanned : undefined}
            />

            {/* Overlay */}
            <View style={styles.overlay} pointerEvents="box-none">
              {/* Top bar */}
              <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
                <TouchableOpacity onPress={handleClose} style={styles.closeIcon}>
                  <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.topBarTitle}>Scan Barcode</Text>
                <View style={{ width: 44 }} />
              </View>

              {/* Scan frame */}
              <View style={styles.scanFrameWrapper} pointerEvents="none">
                <View style={styles.scanFrame}>
                  <View style={[styles.corner, styles.cornerTL]} />
                  <View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} />
                  <View style={[styles.corner, styles.cornerBR]} />
                </View>
                <Text style={styles.scanHint}>
                  Point at a food product barcode
                </Text>
              </View>

              {/* Bottom status */}
              <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 24 }]}>
                {loading && (
                  <View style={styles.statusPill}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.statusText}>Looking up product…</Text>
                  </View>
                )}
                {!loading && !error && scanning && (
                  <View style={styles.statusPill}>
                    <View style={styles.scanDot} />
                    <Text style={styles.statusText}>Ready to scan</Text>
                  </View>
                )}
                {error && (
                  <View style={styles.errorCard}>
                    <Ionicons name="alert-circle-outline" size={20} color="#f87171" />
                    <Text style={styles.errorText}>{error}</Text>
                    <View style={styles.errorActions}>
                      <TouchableOpacity onPress={handleRetry} style={styles.retryBtn}>
                        <Text style={styles.retryText}>Scan Again</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handleManualEntry} style={styles.manualBtn}>
                        <Text style={styles.manualText}>Enter Manually</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const CORNER_SIZE = 24;
const CORNER_THICKNESS = 3;
const CORNER_COLOR = "#fff";

const styles = StyleSheet.create({
  fullscreen: { flex: 1 },
  centeredContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  overlayCenter: {
    flex: 1,
    backgroundColor: "#000000aa",
    alignItems: "center",
    justifyContent: "center",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  topBarTitle: {
    color: "#fff",
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  closeIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  scanFrameWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  scanFrame: {
    width: 260,
    height: 180,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: CORNER_COLOR,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderTopRightRadius: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderBottomRightRadius: 4,
  },
  scanHint: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  bottomBar: {
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 12,
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingTop: 16,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  scanDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4ade80",
  },
  statusText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  errorCard: {
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    gap: 8,
    width: "100%",
  },
  errorText: {
    color: "#f87171",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  errorActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  retryBtn: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryText: {
    color: "#09090b",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  manualBtn: {
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  manualText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  permTitle: {
    fontSize: 20,
    fontFamily: "SpaceGrotesk_700Bold",
    textAlign: "center",
  },
  permSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  permBtn: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
    alignItems: "center",
  },
  permBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  permDenied: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 8,
  },
  cancelLink: { marginTop: 8, padding: 8 },
  cancelLinkText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  card: {
    margin: 24,
    borderRadius: 20,
    padding: 24,
    gap: 16,
    alignSelf: "center",
    width: "90%",
  },
  webUnsupported: { alignItems: "center", gap: 12 },
  webTitle: { fontSize: 18, fontFamily: "SpaceGrotesk_700Bold", textAlign: "center" },
  webSubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  closeBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
