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
  bullets?: string[];
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
        "By creating a RAIMZEAL account or using any RAIMZEAL service, you confirm that you are at least 18 years of age, that you have read and fully understood these Terms, and that you agree to be bound by them in their entirety.",
        "If you do not agree to any part of these Terms, you must not use RAIMZEAL. By tapping \"I Agree & Create Account\" you acknowledge that these Terms form a legally binding agreement between you and RAIMZEAL.",
      ],
    },
    {
      heading: "2. Personal Responsibility & Assumption of Risk",
      icon: "person-outline",
      color: "#C9A84C",
      paragraphs: [
        "YOU ASSUME FULL AND SOLE RESPONSIBILITY FOR ALL DECISIONS, ACTIONS, AND OUTCOMES ARISING FROM YOUR USE OF RAIMZEAL. RAIMZEAL IS A SELF-DIRECTED TOOL. YOU ARE THE DECISION-MAKER.",
        "By using this application you explicitly acknowledge and agree that:",
      ],
      bullets: [
        "You use RAIMZEAL entirely at your own risk and on your own initiative.",
        "You are solely responsible for all workout, dietary, fasting, supplementation, and lifestyle decisions you make based on content within this app.",
        "Any results — positive or negative — from following guidance within RAIMZEAL are entirely your own responsibility.",
        "RAIMZEAL does not control, supervise, or monitor your physical activities or food intake in real time.",
        "You will exercise independent judgement and consult a qualified professional before acting on any information provided.",
        "You will not hold RAIMZEAL, its founders, developers, employees, contractors, or AI systems responsible for any consequence of your personal health or fitness decisions.",
      ],
    },
    {
      heading: "3. Medical Disclaimer — Read Carefully",
      icon: "medical-outline",
      color: "#ef4444",
      paragraphs: [
        "RAIMZEAL IS NOT A MEDICAL DEVICE, MEDICAL SERVICE, OR SUBSTITUTE FOR PROFESSIONAL MEDICAL ADVICE, DIAGNOSIS, OR TREATMENT OF ANY KIND.",
        "The content, AI coaching, workout plans, nutrition guides, and all other information within RAIMZEAL is provided for general educational and motivational purposes only. It is not intended to be used as a basis for any clinical or medical decision.",
        "ALWAYS consult a qualified physician, registered dietitian, or licensed healthcare professional before starting any new exercise programme, dietary protocol, or supplementation regimen — especially if you have any pre-existing condition, take prescription medication, are pregnant, or have a history of eating disorders, cardiovascular disease, diabetes, or joint problems.",
        "DO NOT delay or disregard professional medical advice because of anything you read or receive within this application.",
      ],
    },
    {
      heading: "4. Ovia AI Coaching — Limitations & No Reliance",
      icon: "sparkles-outline",
      color: "#8B31C7",
      paragraphs: [
        "Ovia AI is an artificial intelligence assistant powered by large language model technology. It provides general fitness and wellness guidance based solely on the information you voluntarily provide within the app.",
        "Ovia AI does not have access to your medical records, laboratory results, clinical history, or any diagnostic data. It can make errors, provide outdated information, and misinterpret your situation. Its responses are automatically generated and do not represent the views of a human trainer, physician, or registered dietitian.",
        "You must NEVER rely solely on Ovia AI for any health, medical, psychiatric, or safety decision. RAIMZEAL expressly disclaims all liability for any harm arising from reliance on AI-generated content.",
      ],
    },
    {
      heading: "5. Fitness Safety — Stop If You Feel Unwell",
      icon: "shield-checkmark-outline",
      color: "#3b82f6",
      paragraphs: [
        "Exercise carries inherent physical risk including muscle strains, joint injuries, cardiovascular stress, and in rare cases, serious injury or death. By using RAIMZEAL you accept full personal responsibility for your physical safety during all activities.",
        "You agree to stop immediately and seek emergency medical assistance if you experience: chest pain or pressure, shortness of breath at rest, dizziness or fainting, severe or sudden joint pain, heart palpitations, or any symptom that concerns you.",
        "RAIMZEAL is not liable for any injury, illness, disability, or death resulting from physical activities performed in connection with or inspired by this application.",
      ],
    },
    {
      heading: "6. Fasting & Nutritional Safety",
      icon: "nutrition-outline",
      color: "#22c55e",
      paragraphs: [
        "RAIMZEAL may provide guidance on intermittent fasting, caloric restriction, and dietary protocols. These approaches are NOT suitable for everyone.",
        "You must NOT undertake fasting or restrictive dieting without explicit medical supervision if you: have type 1 or type 2 diabetes; take insulin or blood glucose medication; are pregnant or breastfeeding; have a history of eating disorders; are under 18; or have been advised by a doctor to eat at specific times for medication purposes.",
        "Always break a fast if you feel unwell, faint, or excessively dizzy. Your life and health are always more important than any fitness goal.",
      ],
    },
    {
      heading: "7. Limitation of Liability — No Lawsuit",
      icon: "alert-circle-outline",
      color: "#ef4444",
      paragraphs: [
        "TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, RAIMZEAL AND ITS AFFILIATES, OFFICERS, EMPLOYEES, AGENTS, PARTNERS, AND LICENSORS SHALL NOT BE LIABLE FOR ANY CLAIM, LOSS, OR DAMAGE OF ANY KIND — INCLUDING BUT NOT LIMITED TO PERSONAL INJURY, BODILY HARM, DEATH, PROPERTY DAMAGE, LOSS OF DATA, LOSS OF REVENUE, ECONOMIC LOSS, OR EMOTIONAL DISTRESS — ARISING DIRECTLY OR INDIRECTLY FROM YOUR USE OF OR INABILITY TO USE THE RAIMZEAL PLATFORM.",
        "THIS LIMITATION APPLIES REGARDLESS OF THE LEGAL THEORY UNDER WHICH THE CLAIM IS BROUGHT (CONTRACT, TORT, NEGLIGENCE, STATUTE, OR OTHERWISE), EVEN IF RAIMZEAL HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.",
        "Where applicable law does not allow the complete exclusion of liability, RAIMZEAL's total cumulative liability shall not exceed the total fees paid by you to RAIMZEAL in the 12 months preceding the claim, or £50 (GBP), whichever is greater.",
        "By using this application you waive, to the fullest extent permitted by law, any and all claims against RAIMZEAL arising from your personal health, fitness, or lifestyle choices.",
      ],
    },
    {
      heading: "8. Indemnification",
      icon: "shield-outline",
      color: "#6366f1",
      paragraphs: [
        "You agree to defend, indemnify, and hold harmless RAIMZEAL and its affiliates from and against any claims, liabilities, damages, losses, and expenses — including reasonable legal fees — arising out of or relating to: (a) your use or misuse of the platform; (b) your violation of these Terms; (c) your violation of any third-party rights; or (d) any health or fitness outcome arising from your use of the application.",
      ],
    },
    {
      heading: "9. Email, Push Notifications & Communications",
      icon: "mail-outline",
      color: "#2E8B57",
      paragraphs: [
        "RAIMZEAL may send motivational messages, fitness tips, and health reminders to your registered email address and via push notifications. These are entirely optional and can be disabled in Profile → Reminders.",
        "RAIMZEAL will never sell your email address or personal data to third parties for marketing purposes.",
      ],
    },
    {
      heading: "10. Data, Privacy & Security",
      icon: "lock-closed-outline",
      color: "#6366f1",
      paragraphs: [
        "RAIMZEAL collects personal health data including body measurements, workout history, nutritional logs, and body composition metrics. This data is stored securely via encrypted infrastructure and is used solely to provide and improve your personalised experience.",
        "You have the right to export all your data and to request permanent deletion of your account at any time by contacting support@raimzeal.com.",
      ],
    },
    {
      heading: "11. Community Standards",
      icon: "people-outline",
      color: "#f59e0b",
      paragraphs: [
        "In RAIMZEAL's community features you agree not to post: dangerous health misinformation, unscientific advice, harassment, hate speech, or content that violates the rights of others.",
        "RAIMZEAL reserves the right to remove content and suspend accounts that repeatedly breach community guidelines without notice or refund.",
      ],
    },
    {
      heading: "12. Governing Law & Jurisdiction",
      icon: "globe-outline",
      color: "#6b7280",
      paragraphs: [
        "These Terms shall be governed by and construed in accordance with applicable laws. Any dispute arising from these Terms or your use of RAIMZEAL shall first be submitted to good-faith negotiation. If unresolved within 30 days, disputes shall be submitted to binding arbitration.",
        "You waive any right to participate in class-action lawsuits or class-wide arbitration against RAIMZEAL.",
      ],
    },
    {
      heading: "13. Updates to These Terms",
      icon: "refresh-outline",
      color: "#6b7280",
      paragraphs: [
        `These Terms were last updated in ${LAST_UPDATED}. RAIMZEAL may update these Terms at any time. Continued use of the platform after changes constitutes acceptance of the updated Terms. Material changes will be communicated via the app or email.`,
        "Questions? Contact us at legal@raimzeal.com",
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
            Terms, Conditions & Disclaimer
          </Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            Last updated {LAST_UPDATED} · Please read in full
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
        {/* Critical banner */}
        <View style={[styles.banner, { backgroundColor: "#ef4444" + "15", borderColor: "#ef4444" + "40" }]}>
          <Ionicons name="warning-outline" size={20} color="#ef4444" />
          <Text style={[styles.bannerText, { color: colors.foreground }]}>
            <Text style={{ fontFamily: "Inter_700Bold" }}>IMPORTANT: </Text>
            By creating an account you accept full personal responsibility for your health and fitness decisions. RAIMZEAL accepts no liability for any outcome.
          </Text>
        </View>

        {/* Age restriction banner */}
        <View style={[styles.banner, { backgroundColor: "#C9A84C" + "15", borderColor: "#C9A84C" + "40" }]}>
          <Ionicons name="person-outline" size={18} color="#C9A84C" />
          <Text style={[styles.bannerText, { color: colors.foreground }]}>
            <Text style={{ fontFamily: "Inter_700Bold" }}>18+ ONLY. </Text>
            RAIMZEAL is strictly for adults aged 18 and older. Creating an account as a minor violates these Terms and your account will be terminated.
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
            {s.bullets && (
              <View style={styles.bullets}>
                {s.bullets.map((b, i) => (
                  <View key={i} style={styles.bulletRow}>
                    <Text style={[styles.bulletDot, { color: s.color }]}>•</Text>
                    <Text style={[styles.bulletText, { color: colors.mutedForeground }]}>{b}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}

        <View style={[styles.footer, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Ionicons name="checkmark-circle-outline" size={18} color="#2E8B57" />
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
            By tapping "I Agree & Create Account" during registration you confirm you have read, understood, and agree to all sections of these Terms, including the Medical Disclaimer, Personal Responsibility clause, and the Limitation of Liability.
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
  headerTitle: { fontSize: 16, fontFamily: "SpaceGrotesk_700Bold" },
  headerSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
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
    flexShrink: 0,
  },
  sectionHeading: { flex: 1, fontSize: 14, fontFamily: "Inter_700Bold" },
  para: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  bullets: { gap: 6, paddingLeft: 4 },
  bulletRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  bulletDot: { fontSize: 16, lineHeight: 20, flexShrink: 0 },
  bulletText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  footer: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginTop: 4,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  footerText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
});
