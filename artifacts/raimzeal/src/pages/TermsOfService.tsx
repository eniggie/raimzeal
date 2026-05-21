import { Link } from 'wouter';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function TermsOfService() {
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
            <h1 className="text-2xl font-bold font-display">Terms, Conditions &amp; Disclaimer</h1>
            <p className="text-sm text-muted-foreground">Last updated: May 2026 · Please read in full before using RAIMZEAL</p>
          </div>
        </div>

        <div className="prose prose-invert prose-sm max-w-none space-y-8 text-sm text-muted-foreground leading-relaxed">

          {/* Critical banner */}
          <section>
            <p className="text-foreground font-medium p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
              ⚠️ <strong>IMPORTANT:</strong> By using RAIMZEAL you confirm you are at least 18 years of age, that you have read and fully understood these Terms, and that you agree to be bound by them. You accept full personal responsibility for all health, fitness, and lifestyle decisions you make using this application.
            </p>
          </section>

          {/* Mission statement */}
          <section>
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl space-y-2">
              <p className="text-foreground font-semibold">🌱 About RAIMZEAL</p>
              <p>RAIMZEAL is a <strong className="text-foreground">free, non-profit fitness, food therapy, and healthcare awareness platform</strong> operated by ECONTEUR LLC. We have no membership fees, no paid tiers, no subscriptions, and no hidden charges — ever.</p>
              <p>Our mission is to educate, motivate, and empower individuals with evidence-based health, fitness, food therapy, and healthcare awareness information. <strong className="text-foreground">RAIMZEAL is not here to replace any medical professional, licensed practitioner, therapist, dietitian, or healthcare facility.</strong> We exist to complement their work and help spread health awareness to more people — especially those who cannot easily access professional care.</p>
              <p>We are sustained entirely by voluntary donations from our community. No donation is ever required to access any feature.</p>
            </div>
          </section>

          <section>
            <h2 className="text-foreground font-semibold text-base mb-2">1. Acceptance of Terms</h2>
            <p>These Terms of Service ("Terms") govern your use of the RAIMZEAL fitness application and website at raimzeal.com (the "Service"), operated by ECONTEUR LLC ("we", "us", or "our"). By creating an account, downloading the app, or accessing any part of the Service, you agree to be bound by these Terms and our Privacy Policy. If you are accessing the Service on behalf of an organisation, you represent that you have authority to bind that organisation to these Terms.</p>
          </section>

          <section>
            <h2 className="text-foreground font-semibold text-base mb-2">2. Eligibility &amp; Age Requirement</h2>
            <p>You must be at least <strong className="text-foreground">18 years of age</strong> to use RAIMZEAL. By registering, you represent and warrant that you are 18 or older. We reserve the right to terminate accounts of users found to be under 18. This Service is not directed to persons under 18 and we do not knowingly collect data from minors.</p>
          </section>

          <section>
            <h2 className="text-foreground font-semibold text-base mb-2">3. Medical Disclaimer &amp; Personal Responsibility — Read Carefully</h2>
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl space-y-3">
              <p><strong className="text-foreground">RAIMZEAL IS NOT A MEDICAL DEVICE AND DOES NOT PROVIDE MEDICAL ADVICE, DIAGNOSIS, OR TREATMENT OF ANY KIND.</strong></p>
              <p>All content, AI coaching responses (Ovia AI), workout plans, nutrition guidance, food therapy information, healthcare awareness content, and all other material provided through RAIMZEAL is for <strong className="text-foreground">general educational and informational purposes only.</strong> It is not intended to be, and must not be used as, a substitute for professional medical advice, clinical diagnosis, or medical treatment.</p>
              <p><strong className="text-foreground">RAIMZEAL does not replace your doctor, physician, registered dietitian, licensed nutritionist, therapist, pharmacist, or any other licensed healthcare professional or healthcare facility.</strong> We are here to support and complement qualified healthcare providers — not to take their place.</p>
              <p>By using RAIMZEAL, you expressly acknowledge, understand, and agree that:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong className="text-foreground">You are fully and solely responsible</strong> for every action, decision, and outcome that results from your use of this application or any information obtained from it.</li>
                <li>You assume full personal responsibility for your physical activity, dietary choices, food therapy practices, and all health-related decisions.</li>
                <li>Exercise and dietary changes carry inherent risk of injury or adverse effects. You participate at your own risk.</li>
                <li>You will <strong className="text-foreground">always consult a qualified physician or licensed healthcare professional</strong> before beginning any new exercise programme, diet, nutritional protocol, or supplement regime — especially if you have any pre-existing medical condition, take prescription medication, are pregnant or breastfeeding, or have a history of eating disorders, cardiovascular disease, diabetes, or joint problems.</li>
                <li>You will <strong className="text-foreground">not delay or disregard professional medical advice</strong> because of anything you read, see, or receive through this application.</li>
                <li>Ovia AI responses are generated by artificial intelligence and may contain errors, outdated information, or advice inappropriate for your specific situation. Always verify AI-generated guidance with a qualified professional.</li>
                <li>RAIMZEAL, ECONTEUR LLC, and all affiliated persons shall not be liable for any injury, illness, harm, loss, or adverse outcome arising from your use of or reliance on this Service.</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-foreground font-semibold text-base mb-2">4. Account Registration &amp; Security</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>You must provide accurate, current, and complete information during registration.</li>
              <li>You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.</li>
              <li>You must notify us immediately at support@raimzeal.com of any unauthorised use of your account.</li>
              <li>You may not share your account with any other person or allow others to access the Service through your account.</li>
              <li>We reserve the right to refuse registration or cancel accounts at our sole discretion.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-foreground font-semibold text-base mb-2">5. Free &amp; Non-Profit Service</h2>
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl space-y-2">
              <p><strong className="text-foreground">RAIMZEAL is 100% free — no paid tiers, no subscriptions, no premium features.</strong> Every feature in the application — AI coaching, nutrition tracking, workout logging, body analytics, food guidance, community, and exports — is available to all users at no cost, forever.</p>
              <p>We accept voluntary donations to cover server costs, app maintenance, AI services, and team compensation. Donations are entirely optional and never affect access to any feature. To support our mission: <strong className="text-foreground">donate.stripe.com/aFa6oH7GE50z37Xdmh6kg00</strong></p>
            </div>
          </section>

          <section>
            <h2 className="text-foreground font-semibold text-base mb-2">6. Ovia AI — Artificial Intelligence Coaching</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Ovia AI is an artificial intelligence assistant designed exclusively for fitness, nutrition, food therapy awareness, and general wellness guidance.</li>
              <li>Ovia AI is <strong className="text-foreground">not a licensed medical professional, therapist, registered dietitian, or clinical nutritionist.</strong></li>
              <li>Ovia AI does not have access to your medical records, laboratory results, clinical history, or any diagnostic data. It can make errors, provide outdated information, and misinterpret your situation.</li>
              <li>AI responses may contain errors or advice that is not appropriate for your individual circumstances. Always apply critical judgement and consult a qualified professional where appropriate.</li>
              <li>You may not use Ovia AI to seek advice for medical emergencies. In an emergency, call your local emergency services immediately.</li>
              <li>You must never rely solely on Ovia AI for any health, medical, psychiatric, or safety decision.</li>
              <li>We reserve the right to log AI conversations for safety, quality improvement, and compliance purposes, subject to our Privacy Policy.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-foreground font-semibold text-base mb-2">7. Community Guidelines</h2>
            <p>The RAIMZEAL community feed is a positive space for fitness motivation and health awareness. You agree not to post content that:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Is abusive, harassing, defamatory, threatening, or hateful.</li>
              <li>Promotes dangerous or extreme dieting, disordered eating, or harmful fitness practices.</li>
              <li>Contains nudity, graphic content, or sexual material.</li>
              <li>Infringes any copyright, trademark, or intellectual property right.</li>
              <li>Constitutes spam, advertising, or unsolicited promotion of third-party products.</li>
              <li>Contains false, unscientific, or misleading medical or health claims.</li>
              <li>Violates any applicable law or regulation.</li>
            </ul>
            <p className="mt-2">We reserve the right to remove content and suspend or terminate accounts that violate these guidelines without notice.</p>
          </section>

          <section>
            <h2 className="text-foreground font-semibold text-base mb-2">8. Intellectual Property</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>The RAIMZEAL name, logo, app design, workout content, and all related materials are the intellectual property of ECONTEUR LLC and are protected by copyright, trademark, and other applicable laws.</li>
              <li>You may not copy, modify, distribute, sell, or create derivative works from our content without express written permission.</li>
              <li>You retain ownership of content you create and post (progress photos, community posts). By posting, you grant us a non-exclusive, royalty-free, worldwide licence to display and distribute your content within the Service.</li>
              <li>You represent that you own or have the rights to any content you post.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-foreground font-semibold text-base mb-2">9. Prohibited Uses</h2>
            <p>You may not use the Service to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Reverse engineer, decompile, or disassemble any part of the Service.</li>
              <li>Attempt to gain unauthorised access to any part of our systems or another user's account.</li>
              <li>Use automated bots or scripts to scrape data or abuse our API.</li>
              <li>Interfere with the security or integrity of the Service.</li>
              <li>Violate any applicable local, national, or international law or regulation.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-foreground font-semibold text-base mb-2">10. Disclaimers &amp; Limitation of Liability</h2>
            <p>THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.</p>
            <p className="mt-2">TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, RAIMZEAL AND ECONTEUR LLC SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES — INCLUDING BUT NOT LIMITED TO PERSONAL INJURY, BODILY HARM, DEATH, PROPERTY DAMAGE, LOSS OF DATA, OR LOST PROFITS — ARISING FROM YOUR USE OF OR INABILITY TO USE THE SERVICE, OR FROM YOUR RELIANCE ON ANY HEALTH, FITNESS, NUTRITION, OR FOOD THERAPY INFORMATION PROVIDED HEREIN.</p>
            <p className="mt-2"><strong className="text-foreground">BY USING THIS APPLICATION, YOU ACKNOWLEDGE THAT YOU ARE FULLY AND SOLELY RESPONSIBLE FOR ANY ACTION OR DECISION YOU MAKE BASED ON INFORMATION FROM RAIMZEAL, AND YOU WAIVE ANY CLAIM AGAINST RAIMZEAL OR ECONTEUR LLC ARISING FROM SUCH ACTIONS OR DECISIONS.</strong></p>
            <p className="mt-2">Our total liability to you for any claim shall not exceed the total amount you have voluntarily donated to RAIMZEAL in the 12 months preceding the claim, or USD $50, whichever is greater.</p>
          </section>

          <section>
            <h2 className="text-foreground font-semibold text-base mb-2">11. Indemnification</h2>
            <p>You agree to indemnify, defend, and hold harmless RAIMZEAL, ECONTEUR LLC, and their officers, directors, employees, and agents from and against any claims, damages, losses, costs, and expenses (including reasonable attorneys' fees) arising from: (a) your use of the Service; (b) your violation of these Terms; (c) your violation of any third-party right; (d) any health or fitness outcome arising from your use of the application; or (e) any content you submit to the Service.</p>
          </section>

          <section>
            <h2 className="text-foreground font-semibold text-base mb-2">12. Termination</h2>
            <p>We reserve the right to suspend or terminate your account at any time, with or without cause or notice, including if we believe you have violated these Terms. Upon termination, your right to use the Service ceases immediately. You may also delete your account at any time via Settings. Provisions that by their nature should survive termination (including disclaimers, limitation of liability, and indemnification) shall survive.</p>
          </section>

          <section>
            <h2 className="text-foreground font-semibold text-base mb-2">13. Governing Law &amp; Disputes</h2>
            <p>These Terms are governed by the laws of the State of Arizona, United States, without regard to conflict of law principles. ECONTEUR LLC is registered in the State of Arizona (Phoenix, AZ). Any disputes arising from these Terms or your use of the Service shall first be attempted to be resolved through good-faith negotiation. If unresolved within 30 days, disputes shall be submitted to the courts of competent jurisdiction in Maricopa County, Arizona. You waive any right to participate in class-action proceedings against RAIMZEAL.</p>
          </section>

          <section>
            <h2 className="text-foreground font-semibold text-base mb-2">14. Changes to Terms</h2>
            <p>We may modify these Terms at any time. Material changes will be notified via email or in-app notice at least 7 days before taking effect. Continued use of the Service after changes take effect constitutes acceptance. If you do not agree to updated Terms, you must stop using the Service.</p>
          </section>

          <section>
            <h2 className="text-foreground font-semibold text-base mb-2">15. Contact</h2>
            <div className="p-4 bg-card border border-border rounded-xl">
              <p className="text-foreground font-semibold">RAIMZEAL · operated by ECONTEUR LLC</p>
              <p>Email: <strong className="text-foreground">support@raimzeal.com</strong></p>
              <p>Privacy: <strong className="text-foreground">privacy@raimzeal.com</strong></p>
              <p>Legal: <strong className="text-foreground">legal@raimzeal.com</strong></p>
              <p>Website: <a href="https://www.raimzeal.com" className="text-primary">www.raimzeal.com</a> · <a href="https://www.econteur.com" className="text-primary">www.econteur.com</a></p>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
