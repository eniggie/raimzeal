import React from "react";
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold, useFonts } from "@expo-google-fonts/inter";

const COLORS = {
  background: "#0a0a0b",
  card: "#111113",
  border: "#1e1e22",
  foreground: "#f5f5f6",
  muted: "#71717a",
  primary: "#2E8B57",
  accent: "#8B31C7",
  gold: "#C9A84C",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return <Text style={styles.body}>{children}</Text>;
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

export default function PrivacyScreen() {
  const router = useRouter();
  useFonts({ Inter_400Regular, Inter_600SemiBold, Inter_700Bold });

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.foreground} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Privacy Policy</Text>
          <Text style={styles.headerSub}>Last updated: May 19, 2026</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <Body>
          RAIMZEAL is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our fitness application and related services.
        </Body>

        <TouchableOpacity
          style={styles.webLink}
          onPress={() => Linking.openURL("https://www.raimzeal.com/privacy")}
        >
          <Ionicons name="open-outline" size={14} color={COLORS.primary} />
          <Text style={styles.webLinkText}>View full policy at raimzeal.com/privacy</Text>
        </TouchableOpacity>

        <Section title="1. Information We Collect">
          <Bullet><Text style={styles.bold}>Account information:</Text> name, email address, and profile details when you register.</Bullet>
          <Bullet><Text style={styles.bold}>Health & fitness data:</Text> body weight, height, body measurements, progress photos, workout logs, calorie and macro intake, and water intake.</Bullet>
          <Bullet><Text style={styles.bold}>AI coaching conversations:</Text> messages you send to Ovia AI, stored to provide personalised, contextual coaching.</Bullet>
          <Bullet><Text style={styles.bold}>Community content:</Text> posts, comments, and reactions you publish to the RAIMZEAL community.</Bullet>
          <Bullet><Text style={styles.bold}>Camera & photo library:</Text> accessed only when you use the barcode scanner or upload progress photos, with your permission.</Bullet>
          <Bullet><Text style={styles.bold}>Location:</Text> accessed only when you use the Activity Tracker for outdoor workouts, with your permission.</Bullet>
          <Bullet><Text style={styles.bold}>Payment information:</Text> processed securely by Stripe — we never store your card number.</Bullet>
        </Section>

        <Section title="2. How We Use Your Information">
          <Bullet>Provide, maintain, and improve the RAIMZEAL app.</Bullet>
          <Bullet>Power Ovia AI with your fitness context to generate personalised coaching responses.</Bullet>
          <Bullet>Track your fitness progress, generate charts, and calculate goal metrics.</Bullet>
          <Bullet>Process subscription payments and manage your membership through Stripe.</Bullet>
          <Bullet>Send transactional emails: verification OTPs, welcome messages, and weekly wellness digests (if opted in).</Bullet>
          <Bullet>Enable community features: posts, comments, and likes attributed to your username.</Bullet>
        </Section>

        <Section title="3. Third-Party Services">
          <Bullet><Text style={styles.bold}>Supabase:</Text> stores your account and fitness data in secure PostgreSQL databases with Row Level Security (RLS) — only you can access your own data.</Bullet>
          <Bullet><Text style={styles.bold}>OpenAI:</Text> processes your Ovia AI conversations. API data is not used to train OpenAI models by default.</Bullet>
          <Bullet><Text style={styles.bold}>Stripe:</Text> handles payments. PCI-DSS Level 1 certified.</Bullet>
          <Bullet><Text style={styles.bold}>We do not sell your personal data.</Text></Bullet>
        </Section>

        <Section title="4. Data Security">
          <Bullet>Passwords are hashed using Supabase Auth's bcrypt-based system — never stored in plain text.</Bullet>
          <Bullet>All data in transit is encrypted with TLS (HTTPS enforced).</Bullet>
          <Bullet>Most fitness data is stored locally on your device using encrypted AsyncStorage for offline access.</Bullet>
          <Bullet>Progress photos are stored locally on your device and not uploaded to our servers.</Bullet>
        </Section>

        <Section title="5. Your Rights">
          <Bullet><Text style={styles.bold}>Access & export:</Text> export your data via Settings → Export Data.</Bullet>
          <Bullet><Text style={styles.bold}>Correction:</Text> update your info via Profile → Edit Profile.</Bullet>
          <Bullet><Text style={styles.bold}>Deletion:</Text> delete your account and all data via Settings → Delete Account.</Bullet>
          <Bullet><Text style={styles.bold}>Unsubscribe:</Text> opt out of digest emails via Profile → Reminders or by tapping "Unsubscribe" in any digest email.</Bullet>
        </Section>

        <Section title="6. Children's Privacy">
          <Body>RAIMZEAL is not intended for users under 18. We do not knowingly collect data from minors. If you believe we have data from a minor, contact us at privacy@raimzeal.com.</Body>
        </Section>

        <Section title="7. Contact Us">
          <View style={styles.contactCard}>
            <Text style={styles.contactTitle}>RAIMZEAL</Text>
            <Text style={styles.contactText}>Privacy: privacy@raimzeal.com</Text>
            <Text style={styles.contactText}>Support: support@raimzeal.com</Text>
            <TouchableOpacity onPress={() => Linking.openURL("https://www.raimzeal.com")}>
              <Text style={styles.contactLink}>www.raimzeal.com</Text>
            </TouchableOpacity>
          </View>
        </Section>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.card,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: COLORS.foreground,
  },
  headerSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
  },
  scroll: { flex: 1 },
  content: { padding: 20 },
  webLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.primary + "40",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginVertical: 16,
  },
  webLinkText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: COLORS.primary,
  },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: COLORS.foreground,
    marginBottom: 10,
  },
  body: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: COLORS.muted,
    lineHeight: 20,
    marginBottom: 8,
  },
  bold: {
    fontFamily: "Inter_600SemiBold",
    color: COLORS.foreground,
  },
  bulletRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 7,
  },
  bulletDot: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: COLORS.primary,
    lineHeight: 20,
  },
  bulletText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: COLORS.muted,
    lineHeight: 20,
    flex: 1,
  },
  contactCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  contactTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: COLORS.foreground,
    marginBottom: 4,
  },
  contactText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: COLORS.muted,
  },
  contactLink: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: COLORS.primary,
  },
});
