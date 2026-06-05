import React, { useEffect, useMemo } from "react";
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
const STEPS_GOAL = 10000;

interface StatRowProps {
  icon: string;
  label: string;
  value: string | null;
  unit?: string;
  sub?: string;
  colors: ReturnType<typeof useColors>;
  accent?: string;
}

function StatRow({ icon, label, value, unit, sub, colors, accent }: StatRowProps) {
  return (
    <View style={[styles.statRow, { borderBottomColor: colors.border + "50" }]}>
      <View style={styles.statLeft}>
        <Ionicons name={icon as never} size={18} color={accent ?? colors.mutedForeground} style={styles.statIcon} />
        <View>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
          {sub ? <Text style={[styles.statSub, { color: colors.mutedForeground }]}>{sub}</Text> : null}
        </View>
      </View>
      {value !== null ? (
        <Text style={[styles.statValue, { color: accent ?? colors.foreground }]}>
          {value}
          {unit ? <Text style={[styles.statUnit, { color: colors.mutedForeground }]}> {unit}</Text> : null}
        </Text>
      ) : (
        <Text style={[styles.statEmpty, { color: colors.mutedForeground }]}>—</Text>
      )}
    </View>
  );
}

function SyncQualityBar({ score, colors }: { score: number; colors: ReturnType<typeof useColors> }) {
  const color = score >= 80 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  const label = score >= 80 ? "Excellent" : score >= 50 ? "Partial" : "Limited";
  return (
    <View style={styles.qualityWrap}>
      <View style={styles.qualityHeader}>
        <Text style={[styles.qualityLabel, { color: colors.mutedForeground }]}>Sync quality</Text>
        <Text style={[styles.qualityScore, { color }]}>{label} · {score}%</Text>
      </View>
      <View style={[styles.qualityTrack, { backgroundColor: colors.muted }]}>
        <View style={[styles.qualityFill, { width: `${score}%` as any, backgroundColor: color }]} />
      </View>
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

  const syncQuality = useMemo(() => {
    if (!isAuthorized) return 0;
    const fields = [
      healthData.stepsToday !== null,
      healthData.activeCaloriesToday !== null,
      healthData.sleepLastNightHours !== null,
      healthData.restingHeartRate !== null,
      healthData.latestWeightKg !== null,
    ];
    return Math.round((fields.filter(Boolean).length / fields.length) * 100);
  }, [healthData, isAuthorized]);

  const stepsProgress = healthData.stepsToday !== null
    ? Math.min(healthData.stepsToday / STEPS_GOAL, 1)
    : null;

  const hrZone = useMemo(() => {
    if (healthData.restingHeartRate === null) return null;
    const hr = healthData.restingHeartRate;
    if (hr < 60) return { label: "Athletic", color: "#10b981", tip: "Excellent cardiovascular fitness 🏃" };
    if (hr <= 100) return { label: "Normal", color: "#3b82f6", tip: "Healthy resting heart rate ✓" };
    if (hr <= 110) return { label: "Elevated", color: "#f59e0b", tip: "Slightly elevated — stay hydrated 💧" };
    return { label: "High", color: "#ef4444", tip: "High resting HR — consider seeing a doctor ⚠️" };
  }, [healthData.restingHeartRate]);

  const sleepQuality = useMemo(() => {
    if (healthData.sleepLastNightHours === null) return null;
    const h = healthData.sleepLastNightHours;
    if (h >= 7 && h <= 9) return { label: "Optimal", color: "#10b981" };
    if (h >= 6 || h <= 10) return { label: "Acceptable", color: "#f59e0b" };
    return { label: "Poor", color: "#ef4444" };
  }, [healthData.sleepLastNightHours]);

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
            {[
              { label: "Steps & activity", icon: "footsteps-outline", color: "#3b82f6" },
              { label: "Sleep duration", icon: "moon-outline", color: "#8b5cf6" },
              { label: "Resting heart rate", icon: "heart-outline", color: "#ef4444" },
              { label: "Body weight", icon: "barbell-outline", color: "#10b981" },
              { label: "Active calories", icon: "flame-outline", color: "#f97316" },
            ].map((p) => (
              <View key={p.label} style={styles.permissionRow}>
                <Ionicons name={p.icon as never} size={15} color={p.color} />
                <Text style={[styles.permissionText, { color: colors.foreground }]}>{p.label}</Text>
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

          {/* Sync quality */}
          <View style={[styles.dataCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.dataCardTitle, { color: colors.foreground }]}>Sync Overview</Text>
            <View style={styles.qualityCardBody}>
              <SyncQualityBar score={syncQuality} colors={colors} />
              {syncQuality < 100 && (
                <Text style={[styles.qualityHint, { color: colors.mutedForeground }]}>
                  {syncQuality < 50
                    ? "Limited data — make sure your health app is recording activity."
                    : "Some data points are missing — check that permissions are fully granted."}
                </Text>
              )}
            </View>
          </View>

          {/* Activity */}
          <View style={[styles.dataCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.dataCardTitle, { color: colors.foreground }]}>Today's Activity</Text>
            {stepsProgress !== null && (
              <View style={styles.stepsWrap}>
                <View style={styles.stepsHeader}>
                  <View style={styles.stepsLeft}>
                    <Ionicons name="footsteps-outline" size={18} color="#3b82f6" style={styles.statIcon} />
                    <View>
                      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Steps</Text>
                      <Text style={[styles.stepsGoalText, { color: colors.mutedForeground }]}>Goal: {STEPS_GOAL.toLocaleString()}</Text>
                    </View>
                  </View>
                  <Text style={[styles.stepsValue, { color: stepsProgress >= 1 ? "#10b981" : "#3b82f6" }]}>
                    {healthData.stepsToday!.toLocaleString()}
                    {stepsProgress >= 1 && " ✓"}
                  </Text>
                </View>
                <View style={[styles.stepsTrack, { backgroundColor: colors.muted }]}>
                  <View style={[
                    styles.stepsFill,
                    { width: `${Math.round(stepsProgress * 100)}%` as any, backgroundColor: stepsProgress >= 1 ? "#10b981" : "#3b82f6" },
                  ]} />
                </View>
                <Text style={[styles.stepsPercent, { color: colors.mutedForeground }]}>
                  {stepsProgress >= 1 ? "Daily goal reached! 🎉" : `${Math.round(stepsProgress * 100)}% of daily goal`}
                </Text>
              </View>
            )}
            <StatRow
              icon="flame-outline"
              label="Active calories"
              value={healthData.activeCaloriesToday !== null ? Math.round(healthData.activeCaloriesToday).toString() : null}
              unit="kcal"
              colors={colors}
              accent="#f97316"
            />
          </View>

          {/* Sleep */}
          <View style={[styles.dataCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.dataCardTitle, { color: colors.foreground }]}>Last Night's Sleep</Text>
            <StatRow
              icon="moon-outline"
              label="Duration"
              value={healthData.sleepLastNightHours !== null ? healthData.sleepLastNightHours.toString() : null}
              unit="hrs"
              sub={sleepQuality ? `${sleepQuality.label} — ${healthData.sleepLastNightHours! >= 7 ? "well rested ✓" : "aim for 7–9h"}` : undefined}
              colors={colors}
              accent={sleepQuality?.color ?? "#8b5cf6"}
            />
          </View>

          {/* Body stats */}
          <View style={[styles.dataCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.dataCardTitle, { color: colors.foreground }]}>Body Stats</Text>
            <StatRow
              icon="heart-outline"
              label="Resting heart rate"
              value={healthData.restingHeartRate !== null ? healthData.restingHeartRate.toString() : null}
              unit="bpm"
              sub={hrZone?.tip}
              colors={colors}
              accent={hrZone?.color ?? "#ef4444"}
            />
            <StatRow
              icon="barbell-outline"
              label="Weight"
              value={healthData.latestWeightKg !== null ? healthData.latestWeightKg.toFixed(1) : null}
              unit="kg"
              colors={colors}
              accent="#10b981"
            />
          </View>

          {/* What we track */}
          <View style={[styles.infoCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
              Your health data is read-only, processed on-device, and never sold or shared with third parties.
            </Text>
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
  permissionRow: { flexDirection: "row", alignItems: "center", gap: 10 },
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
  qualityCardBody: { paddingHorizontal: 16, paddingBottom: 14, gap: 8 },
  qualityWrap: { gap: 6 },
  qualityHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  qualityLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  qualityScore: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  qualityTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  qualityFill: { height: "100%", borderRadius: 3 },
  qualityHint: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  stepsWrap: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12, gap: 6 },
  stepsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepsLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepsValue: { fontSize: 18, fontFamily: "SpaceGrotesk_700Bold" },
  stepsGoalText: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  stepsTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  stepsFill: { height: "100%", borderRadius: 3 },
  stepsPercent: { fontSize: 11, fontFamily: "Inter_400Regular" },
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
  statSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  statValue: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  statUnit: { fontSize: 13, fontFamily: "Inter_400Regular" },
  statEmpty: { fontSize: 16, fontFamily: "Inter_400Regular" },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
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
