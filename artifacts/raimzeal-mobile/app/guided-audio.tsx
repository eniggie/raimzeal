/**
 * Guided Audio — meditation, sleep, focus & breathing sessions.
 *
 * Streams a manifest from the backend (GET /api/wellness/audio-sessions) and
 * plays tracks with expo-av. The manifest is fetched at runtime, so once the
 * backend hosts the audio the library appears with no app update required.
 * Until then a friendly "coming soon" state is shown.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { GlassCard } from "@/components/GlassCard";
import { getApiBase } from "@/lib/db";

// Matches the real backend categories (GET /api/wellness/audio-sessions).
type Category = "meditation" | "sleep" | "focus" | "breathwork";

interface AudioSession {
  id: string;
  title: string;
  category: Category;
  durationSec: number;
  url: string;
  artwork?: string;
}

// The backend's wire format — snake_case, "tracks" not "sessions".
interface AudioTrackWire {
  id: string;
  title: string;
  category: string;
  duration_seconds?: number;
  preview_url?: string;
  artist?: string;
}

function mapWireTrack(t: AudioTrackWire): AudioSession | null {
  if (!t?.id || !t.title || !t.preview_url) return null;
  const category: Category = (["meditation", "sleep", "focus", "breathwork"] as const).includes(t.category as Category)
    ? (t.category as Category)
    : "focus";
  return {
    id: t.id,
    title: t.title,
    category,
    durationSec: t.duration_seconds ?? 0,
    url: t.preview_url,
  };
}

const CATEGORY_ORDER: Category[] = ["meditation", "sleep", "focus", "breathwork"];
const CATEGORY_META: Record<Category, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  meditation: { label: "Meditation", icon: "leaf-outline", color: "#1AE07E" },
  sleep: { label: "Sleep", icon: "moon-outline", color: "#A78BFA" },
  focus: { label: "Focus", icon: "headset-outline", color: "#38BDF8" },
  breathwork: { label: "Breathwork", icon: "pulse-outline", color: "#F472B6" },
};

function fmtDuration(sec: number): string {
  if (!sec || sec <= 0) return "";
  const m = Math.round(sec / 60);
  return `${m} min`;
}

export default function GuidedAudioScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [sessions, setSessions] = useState<AudioSession[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Fetch the session manifest.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setErrored(false);
        const res = await fetch(`${getApiBase()}/wellness/audio-sessions`);
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as { tracks?: AudioTrackWire[] } | AudioTrackWire[];
        const wireTracks = Array.isArray(data) ? data : data?.tracks ?? [];
        const list = wireTracks.map(mapWireTrack).filter((s): s is AudioSession => s !== null);
        if (!cancelled) setSessions(list);
      } catch {
        if (!cancelled) {
          setSessions([]);
          setErrored(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Allow playback through the iOS silent switch; unload on unmount.
  useEffect(() => {
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => {});
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const stop = useCallback(async () => {
    try {
      await soundRef.current?.unloadAsync();
    } catch {
      /* ignore */
    }
    soundRef.current = null;
    setPlayingId(null);
  }, []);

  const toggle = useCallback(
    async (session: AudioSession) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      if (playingId === session.id) {
        await stop();
        return;
      }
      setBusyId(session.id);
      try {
        if (soundRef.current) {
          try {
            await soundRef.current.unloadAsync();
          } catch {
            /* ignore */
          }
          soundRef.current = null;
        }
        const { sound } = await Audio.Sound.createAsync({ uri: session.url }, { shouldPlay: true });
        soundRef.current = sound;
        setPlayingId(session.id);
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            stop();
          }
        });
      } catch {
        setPlayingId(null);
      } finally {
        setBusyId(null);
      }
    },
    [playingId, stop],
  );

  const hasSessions = (sessions?.length ?? 0) > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Guided Audio</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : !hasSessions ? (
          <GlassCard style={styles.emptyCard}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.primary + "1A" }]}>
              <Ionicons name="headset-outline" size={28} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              Guided sessions are on the way
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Meditation, sleep stories, focus and breathing audio are being added.
              Check back soon — your library will appear here automatically.
            </Text>
          </GlassCard>
        ) : (
          CATEGORY_ORDER.map((cat) => {
            const items = (sessions ?? []).filter((s) => s.category === cat);
            if (items.length === 0) return null;
            const meta = CATEGORY_META[cat];
            return (
              <View key={cat} style={{ marginBottom: 20 }}>
                <View style={styles.sectionHeader}>
                  <Ionicons name={meta.icon} size={16} color={meta.color} />
                  <Text style={[styles.sectionLabel, { color: colors.foreground }]}>{meta.label}</Text>
                </View>
                {items.map((s) => {
                  const isPlaying = playingId === s.id;
                  const isBusy = busyId === s.id;
                  return (
                    <Pressable key={s.id} onPress={() => toggle(s)}>
                      <GlassCard style={styles.sessionCard}>
                        <View style={[styles.sessionIcon, { backgroundColor: meta.color + "1A" }]}>
                          {isBusy ? (
                            <ActivityIndicator size="small" color={meta.color} />
                          ) : (
                            <Ionicons name={isPlaying ? "pause" : "play"} size={18} color={meta.color} />
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.sessionTitle, { color: colors.foreground }]} numberOfLines={2}>
                            {s.title}
                          </Text>
                          {!!fmtDuration(s.durationSec) && (
                            <Text style={[styles.sessionMeta, { color: colors.mutedForeground }]}>
                              {fmtDuration(s.durationSec)}
                              {isPlaying ? "  ·  Playing" : ""}
                            </Text>
                          )}
                        </View>
                      </GlassCard>
                    </Pressable>
                  );
                })}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  centered: { paddingTop: 60, alignItems: "center" },
  emptyCard: { padding: 24, alignItems: "center", marginTop: 24 },
  emptyIcon: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_700Bold", textAlign: "center", marginBottom: 8 },
  emptyText: { fontSize: 14, lineHeight: 20, fontFamily: "Inter_400Regular", textAlign: "center" },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  sectionLabel: { fontSize: 15, fontFamily: "Inter_700Bold" },
  sessionCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, marginBottom: 10 },
  sessionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  sessionTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  sessionMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
});
