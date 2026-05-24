import React, { useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useHealthSync } from "@/hooks/useHealthSync";

const PLATFORM_NAME = Platform.OS === "ios" ? "Apple Health" : "Google Health Connect";
const PLATFORM_ICON = Platform.OS === "ios" ? "heart" : "pulse";
const PLATFORM_COLOR = Platform.OS === "ios" ? "#ff3b30" : "#34a853";

interface StatRowProps {
  icon: string;
  label: string;
  value: string | null;
  unit?: string;
  colors: ReturnType<typeof useColors>;
}

function StatRow({ icon, label, value, unit, colors }: StatRowProps) {
  return (
    <View style={[styles.statRow, { borderBottomColor: colors.border + "50" }]}>
      <View style={styles.statLeft}>
        <Ionicons name={icon as never} size={18} color={colors.mutedForeground} style={styles.statIcon} />
        <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
      </View>
      {value !== null ? (
        <Text style={[styles.statValue, { color: colors.foreground }]}>
          {value}
          {unit ? <Text style={[styles.statUnit, { color: colors.mutedForeground }]}> {unit}</Text> : null}
        </Text>
      ) : (
        <Text style={[styles.statEmpty, { color: colors.mutedForeground }]}>—</Text>
      )}
    </View>
  );
}

export default function HealthSyncScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    healthData,
    status,
    error,
    isAvailable,
    isAuthorized,
    requestPermissions,
    syncNow,
    disconnect,
  } = useHealthSync();

  useEffect(() => {
    if (isAuthorized && !healthData.lastSynced) {
      syncNow();
    }
  }, [isAuthorized, healthData.lastSynced, syncNow]);

  function confirmDisconnect() {
    Alert.alert(
      `Disconnect ${PLATFORM_NAME}`,
      "This will remove your synced health data from RAIMZEAL. Your data in the Health app stays untouched.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Disconnect", style: "destructive", onPress: disconnect },
      ]
    );
  }

  const lastSyncText = healthData.lastSynced
    ? healthData.lastSynced.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Health Sync</Text>
        {isAuthorized && (
          <TouchableOpacity
            onPress={syncNow}
            disabled={status === "loading"}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {status === "loading" ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="refresh-outline" size={22} color={colors.primary} />
            )}
          </TouchableOpacity>
        )}
        {!isAuthorized && <View style={{ width: 24 }} />}
      </View>

      {/* Platform badge */}
      <View style={[styles.platformBadge, { backgroundColor: PLATFORM_COLOR + "15", borderColor: PLATFORM_COLOR + "40" }]}>
        <Ionicons name={PLATFORM_ICON as never} size={28} color={PLATFORM_COLOR} />
        <View style={styles.platformText}>
          <Text style={[styles.platformName, { color: colors.foreground }]}>{PLATFORM_NAME}</Text>
          <Text style={[styles.platformSub, { color: colors.mutedForeground }]}>
            {Platform.OS === "ios"
              ? "Reads from the Health app on your iPhone"
              : "Reads from Google Health Connect on your device"}
          </Text>
        </View>
        <View style={[
          styles.statusDot,
          { backgroundColor: isAuthorized ? "#30d158" : status === "denied" ? colors.destructive : colors.mutedForeground + "60" },
        ]} />
      </View>

      {/* Not available on web */}
      {!isAvailable && (
        <View style={[styles.unavailableBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Ionicons name="phone-portrait-outline" size={20} color={colors.mutedForeground} />
          <Text style={[styles.unavailableText, { color: colors.mutedForeground }]}>
            Health sync is only available on iOS and Android. Open RAIMZEAL on your phone to connect.
          </Text>
        </View>
      )}

      {/* Error banner */}
      {error && (
        <View style={[styles.errorBox, { backgroundColor: colors.destructive + "12", borderColor: colors.destructive + "30" }]}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
          <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
        </View>
      )}

      {/* Connect CTA */}
      {isAvailable && !isAuthorized && status !== "loading" && (
        <View style={[styles.connectCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.connectTitle, { color: colors.foreground }]}>
            Connect {PLATFORM_NAME}
          </Text>
          <Text style={[styles.connectBody, { color: colors.mutedForeground }]}>
            Automatically import your steps, sleep, heart rate, and weight every time you open the app.
            {Platform.OS === "android"
              ? " Syncs with Samsung Health, Fitbit, Garmin, Withings, and more."
              : " All data stays private and is never shared."}
          </Text>
          <View style={styles.permissionsLabel}>
            <Text style={[styles.permissionsTitle, { color: colors.mutedForeground }]}>RAIMZEAL will read:</Text>
            {["Steps & activity", "Sleep duration", "Heart rate", "Body weight", "Active calories"].map((p) => (
              <View key={p} style={styles.permissionRow}>
                <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                <Text style={[styles.permissionText, { color: colors.foreground }]}>{p}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.connectBtn, { backgroundColor: colors.primary }]}
            onPress={requestPermissions}
          >
            <Ionicons name={PLATFORM_ICON as never} size={18} color={colors.primaryForeground} />
            <Text style={[styles.connectBtnText, { color: colors.primaryForeground }]}>
              Connect {PLATFORM_NAME}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Loading state (first-time authorization) */}
      {status === "loading" && !isAuthorized && (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Connecting…</Text>
        </View>
      )}

      {/* Synced data */}
      {isAuthorized && (
        <>
          {lastSyncText && (
            <Text style={[styles.lastSync, { color: colors.mutedForeground }]}>
              Last synced today at {lastSyncText}
            </Text>
          )}

          <View style={[styles.dataCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.dataCardTitle, { color: colors.foreground }]}>Today</Text>
            <StatRow
              icon="footsteps-outline"
              label="Steps"
              value={healthData.stepsToday !== null ? healthData.stepsToday.toLocaleString() : null}
              colors={colors}
            />
            <StatRow
              icon="flame-outline"
              label="Active calories"
              value={healthData.activeCaloriesToday !== null ? Math.round(healthData.activeCaloriesToday).toString() : null}
              unit="kcal"
              colors={colors}
            />
          </View>

          <View style={[styles.dataCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.dataCardTitle, { color: colors.foreground }]}>Last night</Text>
            <StatRow
              icon="moon-outline"
              label="Sleep"
              value={healthData.sleepLastNightHours !== null ? healthData.sleepLastNightHours.toString() : null}
              unit="hrs"
              colors={colors}
            />
          </View>

          <View style={[styles.dataCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.dataCardTitle, { color: colors.foreground }]}>Body stats</Text>
            <StatRow
              icon="heart-outline"
              label="Heart rate"
              value={healthData.restingHeartRate !== null ? healthData.restingHeartRate.toString() : null}
              unit="bpm"
              colors={colors}
            />
            <StatRow
              icon="barbell-outline"
              label="Weight"
              value={healthData.latestWeightKg !== null ? healthData.latestWeightKg.toFixed(1) : null}
              unit="kg"
              colors={colors}
            />
          </View>

          {/* Disconnect */}
          <Pressable
            onPress={confirmDisconnect}
            style={({ pressed }) => [
              styles.disconnectBtn,
              {
                backgroundColor: pressed ? colors.destructive + "15" : "transparent",
                borderColor: colors.destructive + "40",
              },
            ]}
          >
            <Ionicons name="unlink-outline" size={16} color={colors.destructive} />
            <Text style={[styles.disconnectText, { color: colors.destructive }]}>
              Disconnect {PLATFORM_NAME}
            </Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, gap: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: { fontSize: 22, fontFamily: "SpaceGrotesk_700Bold" },
  platformBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  platformText: { flex: 1 },
  platformName: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 3 },
  platformSub: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  unavailableBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  unavailableText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  connectCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
  connectTitle: { fontSize: 18, fontFamily: "SpaceGrotesk_700Bold" },
  connectBody: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21 },
  permissionsLabel: { gap: 8 },
  permissionsTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 2 },
  permissionRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  permissionText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  connectBtn: {
    height: 52,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 4,
  },
  connectBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  loadingCenter: { alignItems: "center", paddingVertical: 40, gap: 14 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  lastSync: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: -4 },
  dataCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  dataCardTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  statIcon: { width: 22 },
  statLabel: { fontSize: 14, fontFamily: "Inter_400Regular" },
  statValue: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  statUnit: { fontSize: 13, fontFamily: "Inter_400Regular" },
  statEmpty: { fontSize: 16, fontFamily: "Inter_400Regular" },
  disconnectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  disconnectText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
