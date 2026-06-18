import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ConfirmSheet from "@/components/ConfirmSheet";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useColors";
import { useFitness } from "@/contexts/FitnessContext";
import { useTier } from "@/hooks/useTier";
import { supabase } from "@/lib/supabase";
import { getApiBase } from "@/lib/db";

type LegacyTab = "leaderboard" | "report" | "plan" | "partner" | "certificate";

interface LeaderboardEntry {
  id: string;
  name: string;
  handle: string | null;
  streak: number;
  workoutCount: number;
  memberSince: string;
}

interface HealthReport {
  id: string;
  periodLabel: string;
  content: string;
  createdAt: string;
}

interface Partnership {
  partner: { id: string; name: string } | null;
  status: string;
  partnershipId?: string;
}

interface Certificate {
  name: string;
  handle: string | null;
  memberNumber: number;
  memberSince: string;
}

async function getToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function legacyFetch(path: string, opts?: RequestInit) {
  const token = await getToken();
  return fetch(`${getApiBase()}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token ?? ""}`,
      ...(opts?.headers ?? {}),
    },
  });
}

export default function LegacyScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useFitness();
  const { tier, loading: tierLoading } = useTier(user?.id ?? null);

  const [tab, setTab] = useState<LegacyTab>("leaderboard");

  // ── Leaderboard state ─────────────────────────────────────────────────────
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lbLoading, setLbLoading] = useState(false);

  // ── Health report state ───────────────────────────────────────────────────
  const [report, setReport] = useState<HealthReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // ── Coaching plan state ───────────────────────────────────────────────────
  const [plan, setPlan] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(false);

  // ── Partner state ─────────────────────────────────────────────────────────
  const [partnership, setPartnership] = useState<Partnership | null>(null);
  const [partnerLoading, setPartnerLoading] = useState(false);
  const [requesting, setRequesting] = useState(false);

  // ── Certificate state ─────────────────────────────────────────────────────
  const [cert, setCert] = useState<Certificate | null>(null);
  const [certLoading, setCertLoading] = useState(false);
  const [showEndPartnerSheet, setShowEndPartnerSheet] = useState(false);

  // Load data when tab changes
  useEffect(() => {
    if (tab === "leaderboard") loadLeaderboard();
    else if (tab === "report") loadReport();
    else if (tab === "partner") loadPartner();
    else if (tab === "certificate") loadCertificate();
  }, [tab, tier]);

  async function loadLeaderboard() {
    setLbLoading(true);
    try {
      const res = await legacyFetch("/legacy/leaderboard");
      const data = await res.json() as { entries?: LeaderboardEntry[] };
      setLeaderboard(data.entries ?? []);
    } catch { setLeaderboard([]); }
    finally { setLbLoading(false); }
  }

  async function loadReport() {
    setReportLoading(true);
    try {
      const res = await legacyFetch("/legacy/health-report/latest");
      const data = await res.json() as { report?: HealthReport | null };
      setReport(data.report ?? null);
    } catch { setReport(null); }
    finally { setReportLoading(false); }
  }

  async function handleGenerateReport() {
    setGenerating(true);
    try {
      const res = await legacyFetch("/legacy/health-report/generate", { method: "POST" });
      const data = await res.json() as { report?: HealthReport; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setReport(data.report ?? null);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Could not generate report.");
    }
    finally { setGenerating(false); }
  }

  async function handleGeneratePlan() {
    setPlanLoading(true);
    try {
      const res = await legacyFetch("/legacy/coaching-plan", { method: "POST" });
      const data = await res.json() as { plan?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setPlan(data.plan ?? null);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Could not generate plan.");
    }
    finally { setPlanLoading(false); }
  }

  async function loadPartner() {
    setPartnerLoading(true);
    try {
      const res = await legacyFetch("/legacy/partner");
      const data = await res.json() as Partnership;
      setPartnership(data);
    } catch { setPartnership(null); }
    finally { setPartnerLoading(false); }
  }

  async function handleRequestPartner() {
    const name = user?.name || "Legacy Member";
    setRequesting(true);
    try {
      const res = await legacyFetch("/legacy/partner/request", {
        method: "POST",
        body: JSON.stringify({ userName: name }),
      });
      const data = await res.json() as { partnership?: { status: string }; matched?: boolean; partner?: { id: string; name: string } | null; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      if (data.matched && data.partner) {
        Alert.alert("Matched! 🎉", `You've been matched with ${data.partner.name}. Start supporting each other!`);
      } else {
        Alert.alert("Request Sent", "You're in the queue. We'll match you with another Legacy member soon.");
      }
      await loadPartner();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Could not request partner.");
    }
    finally { setRequesting(false); }
  }

  function handleEndPartnership() {
    setShowEndPartnerSheet(true);
  }

  async function confirmEndPartnership() {
    setShowEndPartnerSheet(false);
    await legacyFetch("/legacy/partner/end", { method: "POST" });
    await loadPartner();
  }

  async function loadCertificate() {
    setCertLoading(true);
    try {
      const res = await legacyFetch("/legacy/certificate");
      const data = await res.json() as Certificate;
      setCert(data);
    } catch { setCert(null); }
    finally { setCertLoading(false); }
  }

  // ── Not Legacy gate ───────────────────────────────────────────────────────
  if (tierLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const TABS: { key: LegacyTab; label: string; icon: string }[] = [
    { key: "leaderboard", label: "Board",      icon: "trophy-outline" },
    { key: "report",      label: "Report",     icon: "document-text-outline" },
    { key: "plan",        label: "My Plan",    icon: "fitness-outline" },
    { key: "partner",     label: "Partner",    icon: "people-outline" },
    { key: "certificate", label: "Certificate",icon: "ribbon-outline" },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <LinearGradient
        colors={["#78350f", "#92400e", colors.background]}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#fbbf24" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Ionicons name="trophy" size={20} color="#fbbf24" />
          <Text style={styles.headerTitle}>Legacy Inner Circle</Text>
        </View>
      </LinearGradient>

      {/* Tab row */}
      <View style={[styles.tabRow, { backgroundColor: colors.muted }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRowInner}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[styles.tabBtn, tab === t.key && { backgroundColor: "#92400e" }]}
            >
              <Ionicons
                name={t.icon as any}
                size={14}
                color={tab === t.key ? "#fbbf24" : colors.mutedForeground}
              />
              <Text style={[styles.tabLabel, { color: tab === t.key ? "#fbbf24" : colors.mutedForeground, fontFamily: tab === t.key ? "Inter_600SemiBold" : "Inter_400Regular" }]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={[styles.contentInner, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>

        {/* ── LEADERBOARD ─────────────────────────────────────────── */}
        {tab === "leaderboard" && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Legacy Leaderboard</Text>
            <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>Top Legacy members ranked by streak and total workouts</Text>
            {lbLoading ? (
              <ActivityIndicator style={{ marginTop: 32 }} color={colors.primary} />
            ) : leaderboard.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No other Legacy members yet — you're first. 👑</Text>
            ) : (
              leaderboard.map((entry, i) => (
                <View key={entry.id} style={[styles.lbRow, { backgroundColor: colors.card, borderColor: i === 0 ? "#fbbf24" : colors.border }]}>
                  <View style={[styles.lbRank, { backgroundColor: i === 0 ? "#fbbf24" : i === 1 ? "#9ca3af" : i === 2 ? "#b45309" : colors.muted }]}>
                    <Text style={[styles.lbRankText, { color: i < 3 ? "#000" : colors.mutedForeground }]}>
                      {i === 0 ? "👑" : `#${i + 1}`}
                    </Text>
                  </View>
                  <View style={styles.lbInfo}>
                    <Text style={[styles.lbName, { color: colors.foreground }]}>{entry.name}</Text>
                    {entry.handle && <Text style={[styles.lbHandle, { color: colors.mutedForeground }]}>@{entry.handle}</Text>}
                  </View>
                  <View style={styles.lbStats}>
                    <View style={styles.lbStatItem}>
                      <Text style={[styles.lbStatValue, { color: colors.primary }]}>{entry.streak}</Text>
                      <Text style={[styles.lbStatLabel, { color: colors.mutedForeground }]}>streak</Text>
                    </View>
                    <View style={styles.lbStatItem}>
                      <Text style={[styles.lbStatValue, { color: colors.secondary }]}>{entry.workoutCount}</Text>
                      <Text style={[styles.lbStatLabel, { color: colors.mutedForeground }]}>workouts</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {/* ── HEALTH REPORT ───────────────────────────────────────── */}
        {tab === "report" && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Monthly Health Report</Text>
            <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
              Ovia AI analyses your workouts, nutrition, sleep, and measurements to generate a personalised monthly report.
            </Text>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.primary, opacity: generating ? 0.7 : 1 }]}
              onPress={handleGenerateReport}
              disabled={generating}
            >
              {generating ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="flash-outline" size={16} color="#fff" />}
              <Text style={styles.actionBtnText}>{generating ? "Generating…" : "Generate This Month's Report"}</Text>
            </TouchableOpacity>
            {reportLoading ? (
              <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
            ) : report ? (
              <View style={[styles.reportCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.reportHeader}>
                  <Ionicons name="document-text-outline" size={18} color={colors.primary} />
                  <Text style={[styles.reportPeriod, { color: colors.foreground }]}>{report.periodLabel}</Text>
                  <Text style={[styles.reportDate, { color: colors.mutedForeground }]}>
                    {new Date(report.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={[styles.reportContent, { color: colors.foreground }]}>{report.content}</Text>
              </View>
            ) : (
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No report yet. Generate your first one above.</Text>
            )}
          </>
        )}

        {/* ── COACHING PLAN ───────────────────────────────────────── */}
        {tab === "plan" && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Personalised Coaching Plan</Text>
            <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
              Ovia AI builds you a personalised 4-week training and nutrition plan based on your goals and profile.
            </Text>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#7c3aed", opacity: planLoading ? 0.7 : 1 }]}
              onPress={handleGeneratePlan}
              disabled={planLoading}
            >
              {planLoading ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="fitness-outline" size={16} color="#fff" />}
              <Text style={styles.actionBtnText}>{planLoading ? "Building your plan…" : "Generate My 4-Week Plan"}</Text>
            </TouchableOpacity>
            {plan && (
              <View style={[styles.reportCard, { backgroundColor: colors.card, borderColor: "#7c3aed40" }]}>
                <View style={styles.reportHeader}>
                  <Ionicons name="fitness-outline" size={18} color="#a78bfa" />
                  <Text style={[styles.reportPeriod, { color: colors.foreground }]}>Your 4-Week Plan</Text>
                </View>
                <Text style={[styles.reportContent, { color: colors.foreground }]}>{plan}</Text>
              </View>
            )}
          </>
        )}

        {/* ── ACCOUNTABILITY PARTNER ──────────────────────────────── */}
        {tab === "partner" && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Accountability Partner</Text>
            <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
              Get matched with another Legacy member for mutual accountability, weekly check-ins, and motivation.
            </Text>
            {partnerLoading ? (
              <ActivityIndicator style={{ marginTop: 32 }} color={colors.primary} />
            ) : partnership?.status === "active" && partnership.partner ? (
              <View style={[styles.partnerCard, { backgroundColor: colors.card, borderColor: colors.primary + "40" }]}>
                <LinearGradient colors={[colors.primary + "20", "transparent"]} style={styles.partnerCardGrad}>
                  <Ionicons name="person-circle-outline" size={48} color={colors.primary} />
                  <Text style={[styles.partnerName, { color: colors.foreground }]}>{partnership.partner.name}</Text>
                  <Text style={[styles.partnerLabel, { color: colors.mutedForeground }]}>Your accountability partner</Text>
                  <View style={[styles.partnerBadge, { backgroundColor: colors.primary + "20" }]}>
                    <Ionicons name="checkmark-circle-outline" size={14} color={colors.primary} />
                    <Text style={[styles.partnerBadgeText, { color: colors.primary }]}>Active Partnership</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.endBtn, { borderColor: "#ef4444" }]}
                    onPress={handleEndPartnership}
                  >
                    <Text style={styles.endBtnText}>End Partnership</Text>
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            ) : partnership?.status === "pending" ? (
              <View style={[styles.partnerCard, { backgroundColor: colors.card, borderColor: colors.secondary + "40" }]}>
                <ActivityIndicator color={colors.secondary} />
                <Text style={[styles.partnerName, { color: colors.foreground, marginTop: 12 }]}>Looking for your match…</Text>
                <Text style={[styles.partnerLabel, { color: colors.mutedForeground }]}>
                  You're in the queue. We'll notify you when another Legacy member is matched with you.
                </Text>
              </View>
            ) : (
              <>
                <View style={[styles.partnerEmpty, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Ionicons name="people-outline" size={40} color={colors.mutedForeground} />
                  <Text style={[styles.partnerEmptyTitle, { color: colors.foreground }]}>No partner yet</Text>
                  <Text style={[styles.partnerEmptyText, { color: colors.mutedForeground }]}>
                    Match with a fellow Legacy member. You'll keep each other consistent and motivated.
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.secondary, opacity: requesting ? 0.7 : 1 }]}
                  onPress={handleRequestPartner}
                  disabled={requesting}
                >
                  {requesting ? <ActivityIndicator color="#000" size="small" /> : <Ionicons name="people-outline" size={16} color="#000" />}
                  <Text style={[styles.actionBtnText, { color: "#000" }]}>{requesting ? "Finding your match…" : "Find My Accountability Partner"}</Text>
                </TouchableOpacity>
              </>
            )}
          </>
        )}

        {/* ── CERTIFICATE ─────────────────────────────────────────── */}
        {tab === "certificate" && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Founding Member Certificate</Text>
            <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
              Your official recognition as a Legacy founder of RAIMZEAL.
            </Text>
            {certLoading ? (
              <ActivityIndicator style={{ marginTop: 32 }} color="#fbbf24" />
            ) : cert ? (
              <LinearGradient
                colors={["#78350f", "#1c1917"]}
                style={[styles.certCard, { borderColor: "#fbbf24" }]}
              >
                <View style={styles.certCorner1} />
                <View style={styles.certCorner2} />
                <Ionicons name="ribbon" size={40} color="#fbbf24" style={{ marginBottom: 8 }} />
                <Text style={styles.certTitle}>RAIMZEAL</Text>
                <Text style={styles.certSubtitle}>Legacy Founder Certificate</Text>
                <View style={styles.certDivider} />
                <Text style={styles.certText}>This certifies that</Text>
                <Text style={styles.certName}>{cert.name}</Text>
                {cert.handle && <Text style={styles.certHandle}>@{cert.handle}</Text>}
                <Text style={styles.certText}>is a founding Legacy member</Text>
                <View style={styles.certBadge}>
                  <Text style={styles.certMemberNum}>Legacy Founder #{cert.memberNumber}</Text>
                </View>
                <View style={styles.certDivider} />
                <Text style={styles.certSince}>
                  Member since {new Date(cert.memberSince).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </Text>
                <Text style={styles.certFooter}>Fitness · Food Therapy · Healthcare Awareness</Text>
                <Text style={styles.certFooter}>raimzeal.com</Text>
              </LinearGradient>
            ) : (
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Could not load certificate.</Text>
            )}
          </>
        )}

      </ScrollView>

      <ConfirmSheet
        visible={showEndPartnerSheet}
        title="End Partnership"
        message="Are you sure you want to end this accountability partnership?"
        confirmLabel="End Partnership"
        cancelLabel="Cancel"
        destructive
        onConfirm={confirmEndPartnership}
        onCancel={() => setShowEndPartnerSheet(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  backBtn: { padding: 8, marginLeft: 4 },
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerTitleWrap: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, paddingLeft: 8 },
  headerTitle: { fontSize: 20, fontFamily: "SpaceGrotesk_700Bold", color: "#fbbf24" },
  tabRow: { paddingVertical: 6 },
  tabRowInner: { paddingHorizontal: 12, gap: 6 },
  tabBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  tabLabel: { fontSize: 12 },
  content: { flex: 1 },
  contentInner: { padding: 16 },
  sectionTitle: { fontSize: 20, fontFamily: "SpaceGrotesk_700Bold", marginBottom: 4 },
  sectionSub: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19, marginBottom: 16 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 8, padding: 14, borderRadius: 12, marginBottom: 16 },
  actionBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  emptyText: { textAlign: "center", marginTop: 40, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  // Leaderboard
  lbRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, marginBottom: 8, borderWidth: 1 },
  lbRank: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  lbRankText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  lbInfo: { flex: 1 },
  lbName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  lbHandle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  lbStats: { flexDirection: "row", gap: 12 },
  lbStatItem: { alignItems: "center" },
  lbStatValue: { fontSize: 16, fontFamily: "SpaceGrotesk_700Bold" },
  lbStatLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  // Report & Plan
  reportCard: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 16 },
  reportHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  reportPeriod: { fontSize: 15, fontFamily: "Inter_600SemiBold", flex: 1 },
  reportDate: { fontSize: 11 },
  reportContent: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 21 },
  // Partner
  partnerCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden", marginBottom: 16 },
  partnerCardGrad: { padding: 24, alignItems: "center" },
  partnerName: { fontSize: 18, fontFamily: "SpaceGrotesk_700Bold", marginTop: 8 },
  partnerLabel: { fontSize: 13, marginTop: 4 },
  partnerBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginTop: 12 },
  partnerBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  endBtn: { marginTop: 16, borderWidth: 1, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 },
  endBtnText: { color: "#ef4444", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  partnerEmpty: { borderRadius: 14, borderWidth: 1, padding: 24, alignItems: "center", marginBottom: 16, gap: 8 },
  partnerEmptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  partnerEmptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 19 },
  // Certificate
  certCard: { borderRadius: 20, borderWidth: 2, padding: 32, alignItems: "center", position: "relative", overflow: "hidden" },
  certCorner1: { position: "absolute", top: 8, left: 8, width: 24, height: 24, borderTopWidth: 2, borderLeftWidth: 2, borderColor: "#fbbf24" },
  certCorner2: { position: "absolute", bottom: 8, right: 8, width: 24, height: 24, borderBottomWidth: 2, borderRightWidth: 2, borderColor: "#fbbf24" },
  certTitle: { fontSize: 22, fontFamily: "SpaceGrotesk_700Bold", color: "#fbbf24", letterSpacing: 3 },
  certSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#d97706", letterSpacing: 1, marginTop: 2, marginBottom: 12 },
  certDivider: { width: "80%", height: 1, backgroundColor: "#fbbf2440", marginVertical: 12 },
  certText: { fontSize: 13, color: "#d4d4d4", fontFamily: "Inter_400Regular" },
  certName: { fontSize: 24, fontFamily: "SpaceGrotesk_700Bold", color: "#fef3c7", marginTop: 6, textAlign: "center" },
  certHandle: { fontSize: 14, color: "#d97706", fontFamily: "Inter_400Regular", marginBottom: 4 },
  certBadge: { backgroundColor: "#fbbf2420", borderWidth: 1, borderColor: "#fbbf2440", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginTop: 12 },
  certMemberNum: { fontSize: 14, color: "#fbbf24", fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  certSince: { fontSize: 13, color: "#d4d4d4", fontFamily: "Inter_400Regular", marginTop: 8 },
  certFooter: { fontSize: 10, color: "#78716c", fontFamily: "Inter_400Regular", marginTop: 2 },
  // Gate
  gateWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  gateTitle: { fontSize: 22, fontFamily: "SpaceGrotesk_700Bold", textAlign: "center" },
  gateSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  upgradeBtnGate: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 14, marginTop: 8 },
  upgradeBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#000" },
});
