import { Link } from 'wouter';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Privacy() {
  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-4 pt-6 pb-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold font-display">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground">Last updated: May 19, 2026</p>
          </div>
        </div>

        <div className="prose prose-invert prose-sm max-w-none space-y-8 text-sm text-muted-foreground leading-relaxed">

          <section>
            <p className="text-foreground">
              RAIMZEAL ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our fitness application, website at raimzeal.com, and related services (collectively, the "Service"). Please read this policy carefully. By using RAIMZEAL you agree to the practices described herein.
            </p>
          </section>

          <section>
            <h2 className="text-foreground font-semibold text-base mb-2">1. Information We Collect</h2>
            <h3 className="text-foreground font-medium mb-1">1.1 Information You Provide Directly</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Account information:</strong> name, email address, password (hashed), age, and profile photo when you register.</li>
              <li><strong className="text-foreground">Health &amp; fitness data:</strong> body weight, height, body measurements (chest, waist, hips, arms, thighs), progress photos, workout logs, calorie and macro intake, water intake, and personal records.</li>
              <li><strong className="text-foreground">Nutrition data:</strong> foods logged, meal types, calorie counts, and macronutrient breakdowns.</li>
              <li><strong className="text-foreground">Activity data:</strong> workouts completed, workout duration, estimated calories burned, GPS activity (if you use the Activity Tracker with location permission granted), and step counts.</li>
              <li><strong className="text-foreground">Progress photos:</strong> photographs you voluntarily upload to the Progress Photos feature for before/after comparison. These are stored locally on your device unless you explicitly enable cloud sync.</li>
              <li><strong className="text-foreground">Community content:</strong> posts, comments, and reactions you publish to the RAIMZEAL community feed.</li>
              <li><strong className="text-foreground">AI coaching conversations:</strong> messages you send to Ovia AI and the responses generated. Conversation history is stored to provide personalised, contextual coaching.</li>
              <li><strong className="text-foreground">Donation information:</strong> if you choose to make a voluntary donation to support RAIMZEAL, payment is processed securely by Stripe, Inc. RAIMZEAL is 100% free — donations are never required. We do not store your card number.</li>
              <li><strong className="text-foreground">Communications:</strong> email address for transactional emails (welcome, verification OTP, weekly wellness digest) if you opt in.</li>
              <li><strong className="text-foreground">Reminders &amp; notification preferences:</strong> your chosen notification times and types.</li>
            </ul>

            <h3 className="text-foreground font-medium mb-1 mt-4">1.2 Information Collected Automatically</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Device information:</strong> device type, operating system, app version, and unique device identifiers.</li>
              <li><strong className="text-foreground">Usage data:</strong> features accessed, screens viewed, session duration, and in-app interactions, used to improve the product.</li>
              <li><strong className="text-foreground">Log data:</strong> IP address, browser type, referring URLs, and timestamps when you access our web app or API.</li>
              <li><strong className="text-foreground">Camera &amp; photo library:</strong> accessed only when you explicitly use the barcode scanner or upload progress photos, and only with your permission.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-foreground font-semibold text-base mb-2">2. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Provide, maintain, and improve the RAIMZEAL Service.</li>
              <li>Power Ovia AI — your personal fitness coach — by sending relevant profile data, workout history, nutrition logs, and body measurements to our AI system to generate personalised responses.</li>
              <li>Track your fitness progress, generate charts, and calculate goal metrics.</li>
              <li>Process voluntary donations through Stripe (RAIMZEAL is free — no membership tiers or subscriptions exist).</li>
              <li>Send transactional emails: account verification OTPs, password reset links, and welcome messages.</li>
              <li>Deliver the weekly Ovia AI wellness digest if you have subscribed.</li>
              <li>Enable community features: displaying posts, comments, and likes attributed to your username.</li>
              <li>Display workout programs and community content.</li>
              <li>Comply with legal obligations and enforce our Terms of Service.</li>
              <li>Detect and prevent fraud, abuse, and security incidents.</li>
              <li>Aggregate and anonymise data for product analytics and research (no individual data is shared).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-foreground font-semibold text-base mb-2">3. Legal Basis for Processing (GDPR)</h2>
            <p>For users in the European Economic Area, UK, and similar jurisdictions, we process your personal data on the following legal bases:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Contract:</strong> processing necessary to provide the Service you signed up for.</li>
              <li><strong className="text-foreground">Legitimate interests:</strong> improving our Service, security, fraud prevention, and aggregate analytics.</li>
              <li><strong className="text-foreground">Consent:</strong> sending marketing/digest emails; you may withdraw at any time in the app.</li>
              <li><strong className="text-foreground">Legal obligation:</strong> complying with applicable laws and regulations.</li>
            </ul>
            <p className="mt-2"><strong className="text-foreground">Health data note:</strong> body measurements, weight, progress photos, and fitness data constitute special category health data under GDPR. We process this data solely on the basis of your explicit consent given during sign-up and throughout the Service. You may delete this data at any time.</p>
          </section>

          <section>
            <h2 className="text-foreground font-semibold text-base mb-2">4. How We Share Your Information</h2>
            <p>We do <strong className="text-foreground">not sell your personal data</strong>. We share data only as follows:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Supabase:</strong> our database and authentication provider. Your account and fitness data are stored in Supabase's PostgreSQL database, hosted on AWS. Supabase processes data under its own Privacy Policy and Data Processing Addendum.</li>
              <li><strong className="text-foreground">OpenAI:</strong> messages you send to Ovia AI, along with anonymised fitness context (goals, recent workouts, nutrition data), are sent to OpenAI's API to generate coaching responses. OpenAI processes this data under its API usage policies and does not use API data to train its models by default.</li>
              <li><strong className="text-foreground">Stripe:</strong> payment processing. Stripe receives your email address and payment card details. We never see or store your full card number. Stripe is PCI-DSS Level 1 certified.</li>
              <li><strong className="text-foreground">Brave Search:</strong> when Ovia AI performs a web search to find current fitness research, your search query is sent to Brave's Search API. No personal health data is included in these searches.</li>
              <li><strong className="text-foreground">SMTP provider:</strong> your email address and name are shared with our email delivery service to send transactional and digest emails.</li>
              <li><strong className="text-foreground">Legal requirements:</strong> we may disclose data if required by law, court order, or to protect the rights and safety of RAIMZEAL or others.</li>
              <li><strong className="text-foreground">Business transfers:</strong> in the event of a merger, acquisition, or sale of assets, your data may be transferred to the successor entity with notice to you.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-foreground font-semibold text-base mb-2">5. Data Storage &amp; Security</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Your data is stored on Supabase infrastructure hosted on AWS, protected by Row Level Security (RLS) policies ensuring you can only access your own data.</li>
              <li>Passwords are hashed using Supabase Auth's built-in bcrypt-based hashing. We never store plain-text passwords.</li>
              <li>All data in transit is encrypted using TLS 1.2 or higher (HTTPS enforced everywhere).</li>
              <li>Most fitness and nutrition data is also stored locally on your device using encrypted AsyncStorage for offline access.</li>
              <li>Progress photos are stored locally on your device and are not uploaded to our servers unless you explicitly use a cloud sync feature.</li>
              <li>We apply industry-standard security practices including rate limiting, input validation, and server-side logging with no sensitive data in logs.</li>
              <li>No security system is perfect. In the event of a data breach affecting your rights or freedoms, we will notify you as required by applicable law.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-foreground font-semibold text-base mb-2">6. Data Retention</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Your account and associated data are retained for as long as your account is active.</li>
              <li>If you delete your account, we will delete your personal data within 30 days, except where retention is required by law (e.g., financial records related to Stripe transactions, which Stripe retains per its own policies).</li>
              <li>Anonymised aggregate analytics data may be retained indefinitely.</li>
              <li>Ovia AI conversation history stored in our database is retained for 12 months of inactivity, then automatically purged.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-foreground font-semibold text-base mb-2">7. Your Rights</h2>
            <p>Depending on your location, you may have the following rights regarding your personal data:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Access:</strong> request a copy of the personal data we hold about you.</li>
              <li><strong className="text-foreground">Rectification:</strong> correct inaccurate personal data via Profile → Edit Profile in the app.</li>
              <li><strong className="text-foreground">Erasure ("right to be forgotten"):</strong> request deletion of your account and associated data via Settings → Delete Account, or by emailing us.</li>
              <li><strong className="text-foreground">Data portability:</strong> export your data in JSON format via Settings → Export Data.</li>
              <li><strong className="text-foreground">Restriction:</strong> request we restrict processing of your data in certain circumstances.</li>
              <li><strong className="text-foreground">Objection:</strong> object to processing based on legitimate interests.</li>
              <li><strong className="text-foreground">Withdraw consent:</strong> unsubscribe from the weekly digest at any time via Profile → Reminders, or by clicking "Unsubscribe" in any digest email.</li>
              <li><strong className="text-foreground">California residents (CCPA):</strong> you have the right to know what personal information is collected, the right to delete it, and the right to opt out of the sale of personal information (we do not sell personal information).</li>
            </ul>
            <p className="mt-2">To exercise any of these rights, contact us at <strong className="text-foreground">support@raimzeal.com</strong> or through Settings in the app.</p>
          </section>

          <section>
            <h2 className="text-foreground font-semibold text-base mb-2">8. Children's Privacy</h2>
            <p>RAIMZEAL is not intended for users under the age of 18. We do not knowingly collect personal information from anyone under 18. Our Terms of Service require users to be at least 18 years old. If we learn that we have collected personal data from a person under 18, we will delete that data immediately. If you believe we have collected data from a minor, contact us at support@raimzeal.com.</p>
          </section>

          <section>
            <h2 className="text-foreground font-semibold text-base mb-2">9. Cookies &amp; Tracking</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Our web app uses browser localStorage and sessionStorage to store your fitness data and preferences locally on your device.</li>
              <li>We use Supabase session tokens (stored as cookies or localStorage) for authentication.</li>
              <li>We do not use third-party advertising cookies or tracking pixels.</li>
              <li>We do not use Google Analytics or other third-party analytics trackers.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-foreground font-semibold text-base mb-2">10. Third-Party Links</h2>
            <p>The weekly wellness digest and in-app content may contain links to external health resources (Mayo Clinic, PubMed, Healthline, etc.). These sites have their own privacy policies. We are not responsible for their practices. We encourage you to review the privacy policy of any site you visit.</p>
          </section>

          <section>
            <h2 className="text-foreground font-semibold text-base mb-2">11. International Data Transfers</h2>
            <p>RAIMZEAL is operated from Nigeria and serves users globally. Your data may be transferred to and processed in countries other than your country of residence (including the United States, where Supabase, OpenAI, and Stripe are based). We rely on Standard Contractual Clauses and equivalent mechanisms to ensure adequate protection for cross-border data transfers where applicable.</p>
          </section>

          <section>
            <h2 className="text-foreground font-semibold text-base mb-2">12. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. When we make material changes, we will notify you via email (if you have provided one) or through a prominent notice in the app at least 7 days before the change takes effect. The "Last updated" date at the top of this page will always reflect the most recent version. Continued use of the Service after changes take effect constitutes your acceptance of the updated policy.</p>
          </section>

          <section>
            <h2 className="text-foreground font-semibold text-base mb-2">13. Contact Us</h2>
            <p>If you have any questions, concerns, or requests regarding this Privacy Policy or how we handle your personal data, please contact us:</p>
            <div className="mt-2 p-4 bg-card border border-border rounded-xl">
              <p className="text-foreground font-semibold">RAIMZEAL</p>
              <p>Email: <strong className="text-foreground">privacy@raimzeal.com</strong></p>
              <p>Website: <a href="https://www.raimzeal.com" className="text-primary">www.raimzeal.com</a></p>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
