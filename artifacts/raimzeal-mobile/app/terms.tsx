import React from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const LAST_UPDATED = "May 2026";

interface Section {
  heading: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  paragraphs: string[];
}

export default function TermsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === "web" ? 20 : insets.top;

  const sections: Section[] = [
    {
      heading: "1. Acceptance of Terms",
      icon: "checkmark-circle-outline",
      color: "#2E8B57",
      paragraphs: [
        "By creating a RAIMZEAL account or using any RAIMZEAL service, you confirm that you are at least 16 years of age (or 18 in jurisdictions where minors require parental consent), that you have read and understood these Terms, and that you agree to be bound by them.",
        "If you are using RAIMZEAL on behalf of an organisation, you confirm you have authority to bind that organisation to these Terms.",
      ],
    },
    {
      heading: "2. Critical Health & Medical Disclaimer",
      icon: "medical-outline",
      color: "#ef4444",
      paragraphs: [
        "RAIMZEAL is a personal health and fitness tracking platform. It is NOT a medical device, medical service, or substitute for professional medical advice, diagnosis, or treatment.",
        "Always consult a qualified physician, registered dietitian, or licensed healthcare professional before starting any new exercise programme, dietary protocol, supplementation regimen, or fasting practice — especially if you have any pre-existing medical conditions, take prescription medications, are pregnant or breastfeeding, or have a history of eating disorders, cardiovascular disease, diabetes, or bone/joint conditions.",
        "The information, recommendations, and AI-generated coaching provided within RAIMZEAL are for general educational and motivational purposes only. They do not constitute personalised medical advice. Do not delay seeking professional medical advice because of anything you have read or received within this application.",
      ],
    },
    {
      heading: "3. Ovia AI Coaching — Limitations",
      icon: "sparkles-outline",
      color: "#8B31C7",
      paragraphs: [
        "RAIMZEAL features Ovia AI, an artificial intelligence fitness and wellness coaching assistant powered by large language model technology. Ovia AI provides general guidance based on publicly available health and fitness research.",
        "Ovia AI does not have access to your medical records, blood tests, clinical history, or any diagnostic data. Its recommendations are based solely on the information you voluntarily provide within the app. Ovia AI can make errors, may provide outdated information, and should never be used as a sole source of health decision-making.",
        "Ovia AI's responses are automatically generated and do not represent the views of a human trainer, physician, or registered dietitian. Always apply critical judgement to AI-generated health recommendations.",
        "You acknowledge that AI-generated content may occasionally contain inaccuracies, and RAIMZEAL does not guarantee the accuracy, completeness, or suitability of any Ovia AI response for your specific health situation.",
      ],
    },
    {
      heading: "4. Fitness Safety & User Responsibility",
      icon: "shield-checkmark-outline",
      color: "#C9A84C",
      paragraphs: [
        "Exercise carries inherent risks including but not limited to muscle strains, joint injuries, cardiovascular stress, and in rare cases, serious injury or death. By using RAIMZEAL's workout programmes and logging features, you accept full personal responsibility for your physical safety.",
        "You agree to: warm up properly before every workout; stop immediately if you experience chest pain, dizziness, shortness of breath, or severe joint pain; work within your current fitness level; use proper form on all exercises; and seek professional supervision if you are new to strength training.",
        "RAIMZEAL is not liable for any injury, illness, or adverse health outcome resulting from physical activities performed in connection with or inspired by content within the application.",
      ],
    },
    {
      heading: "5. Fasting & Nutritional Safety",
      icon: "nutrition-outline",
      color: "#3b82f6",
      paragraphs: [
        "RAIMZEAL and Ovia AI may provide guidance on intermittent fasting, caloric restriction, and dietary protocols. These approaches are NOT suitable for everyone.",
        "You must NOT fast or follow restrictive dietary protocols without medical supervision if you: have type 1 or type 2 diabetes; are taking insulin or other blood glucose medications; are pregnant or breastfeeding; have a history of eating disorders (anorexia, bulimia, or binge eating disorder); are a child or adolescent under 18; have been advised by your doctor to eat at specific times for medication purposes.",
        "Always break a fast if you feel unwell, faint, excessively dizzy, or if any medication requires food. Your health and safety come before any fitness goal.",
      ],
    },
    {
      heading: "6. Email & Push Notifications",
      icon: "mail-outline",
      color: "#2E8B57",
      paragraphs: [
        "RAIMZEAL may send you motivational messages, fitness tips, and reminders to the email address you registered with. These messages are sent by Ovia AI, your personal fitness coach, and are entirely optional.",
        "You may opt out of email reminders at any time by disabling them in the app under Profile → Reminders, or by contacting us. You may opt out of push notifications at any time through your device settings.",
        "RAIMZEAL will never share your email address with third parties for marketing purposes.",
      ],
    },
    {
      heading: "7. Data, Privacy & Security",
      icon: "lock-closed-outline",
      color: "#6366f1",
      paragraphs: [
        "RAIMZEAL collects personal health data including but not limited to body measurements, workout history, nutritional logs, and body composition metrics. This data is stored securely via Supabase's encrypted infrastructure and is used solely to provide and improve your personalised fitness experience.",
        "Your health data is private and will not be sold to third parties. Aggregated, anonymised data may be used to improve RAIMZEAL's algorithms and recommendations.",
        "You have the right to export all your data (via the PDF export feature) and to request permanent deletion of your account and associated data by contacting RAIMZEAL support.",
      ],
    },
    {
      heading: "8. User Conduct",
      icon: "people-outline",
      color: "#f59e0b",
      paragraphs: [
        "In RAIMZEAL's community features, you agree not to post: medical misinformation, dangerous or unscientific health advice, harassment, hate speech, or content that violates the rights of others.",
        "RAIMZEAL reserves the right to remove any community content that violates these standards and to suspend accounts that repeatedly breach community guidelines.",
      ],
    },
    {
      heading: "9. Limitation of Liability",
      icon: "alert-circle-outline",
      color: "#ef4444",
      paragraphs: [
        "To the maximum extent permitted by applicable law, RAIMZEAL and its affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to personal injury, property damage, loss of data, loss of revenue, or emotional distress, arising from your use of the platform.",
        "RAIMZEAL's total cumulative liability to you for any claims arising from use of the service shall not exceed the total amount paid by you to RAIMZEAL in the 12 months preceding the claim.",
      ],
    },
    {
      heading: "10. Updates to These Terms",
      icon: "refresh-outline",
      color: "#6b7280",
      paragraphs: [
        `These Terms were last updated in ${LAST_UPDATED}. RAIMZEAL may update these Terms from time to time. Continued use of the platform after any changes constitutes acceptance of the updated Terms. We will notify you of material changes via the app or by email.`,
        "Questions about these Terms? Contact us at legal@raimzeal.com.",
      ],
    },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 12,
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Terms & Conditions
          </Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            Last updated {LAST_UPDATED}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Platform.OS === "web" ? 40 : insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.banner, { backgroundColor: "#ef4444" + "15", borderColor: "#ef4444" + "40" }]}>
          <Ionicons name="warning-outline" size={20} color="#ef4444" />
          <Text style={[styles.bannerText, { color: colors.foreground }]}>
            Please read carefully. Section 2 (Medical Disclaimer) and Section 5 (Fasting Safety) contain critical health safety information.
          </Text>
        </View>

        {sections.map((s) => (
          <View key={s.heading} style={[styles.section, { borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: s.color + "20" }]}>
                <Ionicons name={s.icon} size={18} color={s.color} />
              </View>
              <Text style={[styles.sectionHeading, { color: colors.foreground }]}>
                {s.heading}
              </Text>
            </View>
            {s.paragraphs.map((p, i) => (
              <Text key={i} style={[styles.para, { color: colors.mutedForeground }]}>
                {p}
              </Text>
            ))}
          </View>
        ))}

        <View style={[styles.footer, { backgroundColor: colors.muted }]}>
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
            By tapping "I Agree & Create Account" during registration, you confirm you have read, understood, and agree to all sections of these Terms & Conditions, including the Critical Health & Medical Disclaimer.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

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
  backBtn: { padding: 4 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 17, fontFamily: "SpaceGrotesk_700Bold" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  content: { padding: 16, gap: 14 },
  banner: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  bannerText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 19 },
  section: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeading: { flex: 1, fontSize: 14, fontFamily: "Inter_700Bold" },
  para: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  footer: {
    borderRadius: 14,
    padding: 16,
    marginTop: 4,
  },
  footerText: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18, textAlign: "center" },
});
