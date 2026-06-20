export default function OperationsGuide() {
  return (
    <div className="max-w-4xl mx-auto px-8 py-12">
      <div className="mb-8">
        <div className="text-xs font-semibold text-chart-3 uppercase tracking-widest mb-2">Guide 3</div>
        <h1 className="text-4xl font-bold text-foreground mb-3">Operations Guide</h1>
        <p className="text-muted-foreground text-lg">
          Dr. Oviawe's operations manual — platform status, monthly costs, maintenance, monitoring,
          investor strategy, 501(c)(3) setup, and the long-term scaling plan.
        </p>
        <div className="flex gap-3 mt-4 text-sm text-muted-foreground">
          <span>RAIMZEAL v1.3.0</span>
          <span>·</span>
          <span>June 2026</span>
          <span>·</span>
          <span>ECONTEUR LLC</span>
        </div>
      </div>

      <nav className="bg-card border border-border rounded-lg p-5 mb-10">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Table of Contents</div>
        <ol className="space-y-1 text-sm text-primary">
          <li><a href="#status" className="hover:underline">1. Platform Status — June 2026</a></li>
          <li><a href="#costs" className="hover:underline">2. Infrastructure & Monthly Costs</a></li>
          <li><a href="#maintenance" className="hover:underline">3. Maintenance Schedule</a></li>
          <li><a href="#monitoring" className="hover:underline">4. Monitoring & Alerts</a></li>
          <li><a href="#app-store" className="hover:underline">5. App Store Management</a></li>
          <li><a href="#investor" className="hover:underline">6. Investor & Grant Strategy</a></li>
          <li><a href="#nonprofit" className="hover:underline">7. 501(c)(3) Foundation Setup</a></li>
          <li><a href="#incident" className="hover:underline">8. Incident Response</a></li>
          <li><a href="#scaling" className="hover:underline">9. Scaling Plan</a></li>
        </ol>
      </nav>

      <section id="status" className="mb-12">
        <h2 className="text-2xl font-bold text-foreground mb-4 pb-2 border-b border-border">1. Platform Status — June 2026</h2>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Version</div>
            <div className="text-2xl font-bold text-primary">v1.3.0</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">iOS Status</div>
            <div className="text-lg font-bold text-primary">Submission In Progress</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Android Status</div>
            <div className="text-lg font-bold text-muted-foreground">Planned Q3 2026</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Monthly Cost</div>
            <div className="text-2xl font-bold text-secondary">~$51</div>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg">
            <div className="w-3 h-3 rounded-full bg-secondary flex-shrink-0"></div>
            <div className="text-sm text-foreground"><strong>API Server</strong> — Operational. Running on Replit Autoscale. Healthcheck: /api/healthz</div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg">
            <div className="w-3 h-3 rounded-full bg-secondary flex-shrink-0"></div>
            <div className="text-sm text-foreground"><strong>Web App</strong> — Operational. Deployed at raimzeal.com (Replit)</div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg">
            <div className="w-3 h-3 rounded-full bg-secondary flex-shrink-0"></div>
            <div className="text-sm text-foreground"><strong>Supabase Database</strong> — Operational. Free tier. Row Level Security enabled on all tables.</div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg">
            <div className="w-3 h-3 rounded-full bg-primary flex-shrink-0"></div>
            <div className="text-sm text-foreground"><strong>iOS App Store</strong> — Submission in progress. Compliance audit complete. Apple Sign In approved.</div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg">
            <div className="w-3 h-3 rounded-full bg-muted-foreground flex-shrink-0"></div>
            <div className="text-sm text-foreground"><strong>Android Google Play</strong> — Not yet submitted. Planned Q3 2026.</div>
          </div>
        </div>
      </section>

      <section id="costs" className="mb-12">
        <h2 className="text-2xl font-bold text-foreground mb-4 pb-2 border-b border-border">2. Infrastructure & Monthly Costs</h2>

        <p className="text-foreground leading-relaxed mb-4">
          RAIMZEAL's infrastructure is deliberately minimal. The entire platform runs for under $55/month
          — a cost structure that makes grant sustainability straightforward.
        </p>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">2.1 Monthly Cost Breakdown</h3>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted border-b-2 border-primary">
                <th className="text-left p-3 font-semibold text-muted-foreground">Service</th>
                <th className="text-left p-3 font-semibold text-muted-foreground">Plan</th>
                <th className="text-right p-3 font-semibold text-muted-foreground">Monthly</th>
                <th className="text-right p-3 font-semibold text-muted-foreground">Annual</th>
                <th className="text-left p-3 font-semibold text-muted-foreground">Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border">
                <td className="p-3 font-medium text-foreground">Replit</td>
                <td className="p-3 text-muted-foreground">Starter</td>
                <td className="p-3 text-right text-foreground">$19.00</td>
                <td className="p-3 text-right text-foreground">$228.00</td>
                <td className="p-3 text-muted-foreground">Hosts API server + web app + all artifacts</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 font-medium text-foreground">EAS (Expo Application Services)</td>
                <td className="p-3 text-muted-foreground">Starter</td>
                <td className="p-3 text-right text-foreground">$19.00</td>
                <td className="p-3 text-right text-foreground">$228.00</td>
                <td className="p-3 text-muted-foreground">Mobile builds for iOS + Android</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 font-medium text-foreground">Apple Developer Program</td>
                <td className="p-3 text-muted-foreground">Individual</td>
                <td className="p-3 text-right text-foreground">~$8.25</td>
                <td className="p-3 text-right text-foreground">$99.00</td>
                <td className="p-3 text-muted-foreground">Billed annually. Required for App Store.</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 font-medium text-foreground">Supabase</td>
                <td className="p-3 text-muted-foreground">Free</td>
                <td className="p-3 text-right text-secondary font-semibold">$0.00</td>
                <td className="p-3 text-right text-secondary font-semibold">$0.00</td>
                <td className="p-3 text-muted-foreground">Free up to 50K MAU, 500MB storage</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 font-medium text-foreground">Domain (raimzeal.com)</td>
                <td className="p-3 text-muted-foreground">Annual</td>
                <td className="p-3 text-right text-foreground">~$1.50</td>
                <td className="p-3 text-right text-foreground">~$18.00</td>
                <td className="p-3 text-muted-foreground">Domain registrar</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 font-medium text-foreground">OpenAI API</td>
                <td className="p-3 text-muted-foreground">Pay-as-you-go</td>
                <td className="p-3 text-right text-foreground">~$3.00</td>
                <td className="p-3 text-right text-foreground">~$36.00</td>
                <td className="p-3 text-muted-foreground">Estimated at current user volume. Scales with usage.</td>
              </tr>
              <tr className="bg-primary/10 border-b border-primary/30">
                <td className="p-3 font-bold text-primary">TOTAL</td>
                <td className="p-3 text-muted-foreground"></td>
                <td className="p-3 text-right font-bold text-primary">~$50.75</td>
                <td className="p-3 text-right font-bold text-primary">~$609.00</td>
                <td className="p-3 text-muted-foreground">Subject to usage growth</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">2.2 Grant Runway Analysis</h3>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted border-b border-border">
                <th className="text-left p-3 font-semibold text-muted-foreground">Grant Size</th>
                <th className="text-right p-3 font-semibold text-muted-foreground">Runway (at $609/yr)</th>
                <th className="text-left p-3 font-semibold text-muted-foreground">Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border"><td className="p-3 text-foreground">$10,000</td><td className="p-3 text-right text-foreground">16 years</td><td className="p-3 text-muted-foreground">Small health foundation grant</td></tr>
              <tr className="border-b border-border"><td className="p-3 text-foreground">$50,000</td><td className="p-3 text-right text-foreground">82 years</td><td className="p-3 text-muted-foreground">Mid-size NIH supplemental grant</td></tr>
              <tr className="border-b border-border"><td className="p-3 text-foreground">$250,000</td><td className="p-3 text-right text-foreground">410 years</td><td className="p-3 text-muted-foreground">Gates Foundation / health-focused donor</td></tr>
              <tr><td className="p-3 text-foreground">$1,000,000</td><td className="p-3 text-right font-bold text-primary">1,642 years</td><td className="p-3 text-muted-foreground">Major institutional grant</td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-muted-foreground text-sm">
          Note: These figures assume zero user growth in infrastructure costs. The Supabase free tier
          supports up to 50,000 monthly active users. Beyond that, Supabase Pro ($25/month) supports
          100,000 MAU — still negligible cost.
        </p>
      </section>

      <section id="maintenance" className="mb-12">
        <h2 className="text-2xl font-bold text-foreground mb-4 pb-2 border-b border-border">3. Maintenance Schedule</h2>
        <p className="text-foreground leading-relaxed mb-4">
          RAIMZEAL is designed to be low-maintenance. The following schedule captures everything
          needed to keep the platform healthy.
        </p>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">3.1 Daily (5 minutes)</h3>
        <ul className="list-disc list-inside space-y-1 text-foreground text-sm mb-4 ml-4">
          <li>Check the Replit deployment status — confirm the API healthcheck is green.</li>
          <li>Review any new user bug reports (Settings → Help → Report a Bug in the app).</li>
          <li>Check Supabase for any failed auth or database error alerts.</li>
        </ul>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">3.2 Weekly (30 minutes)</h3>
        <ul className="list-disc list-inside space-y-1 text-foreground text-sm mb-4 ml-4">
          <li>Review community moderation queue — approve or remove flagged posts and comments.</li>
          <li>Check OpenAI usage dashboard for any unusual cost spikes.</li>
          <li>Review Supabase query performance dashboard for slow queries.</li>
          <li>Check for available dependency updates: <code className="bg-muted px-1 py-0.5 rounded text-primary">pnpm outdated</code>.</li>
          <li>Review Expo SDK and EAS release notes for security patches.</li>
        </ul>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">3.3 Monthly (2–3 hours)</h3>
        <ul className="list-disc list-inside space-y-1 text-foreground text-sm mb-4 ml-4">
          <li>Apply security-relevant dependency updates and run full typechecks.</li>
          <li>Review Supabase Row Level Security policies — confirm no regressions.</li>
          <li>Review USPSTF screening guidelines for any updates that affect Preventive Health recommendations.</li>
          <li>Review app analytics — active users, feature engagement, retention.</li>
          <li>Invoice review — confirm all subscriptions (Replit, EAS, Apple Developer) are current.</li>
          <li>Back up the OpenAPI spec and database schema to a secondary location.</li>
          <li>Release a new app version if significant fixes or features have accumulated.</li>
        </ul>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">3.4 Annually</h3>
        <ul className="list-disc list-inside space-y-1 text-foreground text-sm mb-4 ml-4">
          <li>Renew Apple Developer Program ($99/year — renews automatically if auto-renew is on).</li>
          <li>Renew domain registration (raimzeal.com).</li>
          <li>Review and update the privacy policy for any regulatory changes (HIPAA, GDPR, CCPA).</li>
          <li>Full security audit — run dependency audit, SAST scan, and hound-dog scan.</li>
          <li>Review the 501(c)(3) compliance requirements and update governance documents.</li>
        </ul>
      </section>

      <section id="monitoring" className="mb-12">
        <h2 className="text-2xl font-bold text-foreground mb-4 pb-2 border-b border-border">4. Monitoring & Alerts</h2>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">4.1 Healthcheck</h3>
        <p className="text-foreground leading-relaxed mb-3">
          The API server exposes a healthcheck endpoint at <code className="bg-muted px-1 py-0.5 rounded text-sm text-primary">/api/healthz</code>.
          This returns HTTP 200 when the server is running and connected to the database. Replit's
          deployment system polls this endpoint automatically.
        </p>
        <p className="text-foreground leading-relaxed mb-3">
          To manually check from the command line:
        </p>
        <div className="bg-muted rounded-lg p-4 font-mono text-sm text-foreground mb-4">
          <div>curl -sf https://raimzeal.com/api/healthz && echo "API healthy"</div>
        </div>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">4.2 Supabase Monitoring</h3>
        <ul className="list-disc list-inside space-y-1 text-foreground text-sm mb-4 ml-4">
          <li>Log in to <strong>app.supabase.com</strong> → your project → Logs → API logs to see real-time request logs.</li>
          <li>Database → Query Performance shows slow queries.</li>
          <li>Auth → Users shows recent sign-ins and auth errors.</li>
          <li>The free tier includes 500MB of database storage. When usage approaches 400MB, migrate to Supabase Pro ($25/month).</li>
        </ul>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">4.3 Setting Up Uptime Alerts (Recommended)</h3>
        <p className="text-foreground leading-relaxed mb-3">
          Use a free uptime monitoring service (Better Uptime, UptimeRobot, or Freshping) to receive
          an email or SMS if the API healthcheck fails. Configure it to check
          <code className="bg-muted px-1 py-0.5 rounded text-sm text-primary mx-1">/api/healthz</code>
          every 5 minutes. This is free and takes 5 minutes to set up.
        </p>
        <ol className="list-decimal list-inside space-y-1 text-foreground text-sm mb-4 ml-4">
          <li>Create a free account at uptimerobot.com.</li>
          <li>Add a new monitor: HTTP(s) type, URL = https://raimzeal.com/api/healthz.</li>
          <li>Set check interval to 5 minutes.</li>
          <li>Add your email for alerts.</li>
          <li>Save. You will now receive an email within 5 minutes of any outage.</li>
        </ol>
      </section>

      <section id="app-store" className="mb-12">
        <h2 className="text-2xl font-bold text-foreground mb-4 pb-2 border-b border-border">5. App Store Management</h2>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">5.1 iOS App Store (Apple)</h3>
        <p className="text-foreground leading-relaxed mb-3">
          RAIMZEAL's iOS app submission is in progress as of June 2026. Once live, updates follow this process:
        </p>
        <ol className="list-decimal list-inside space-y-2 text-foreground text-sm mb-4 ml-4">
          <li>Make code changes and test on local simulator or TestFlight.</li>
          <li>Increment <code className="bg-muted px-1 py-0.5 rounded text-primary">version</code> and <code className="bg-muted px-1 py-0.5 rounded text-primary">ios.buildNumber</code> in app.json.</li>
          <li>Build: <code className="bg-muted px-1 py-0.5 rounded text-primary">eas build --profile production --platform ios</code> (run from local machine — not Replit, due to git restriction).</li>
          <li>Submit: <code className="bg-muted px-1 py-0.5 rounded text-primary">eas submit --platform ios --latest</code>.</li>
          <li>In App Store Connect, complete What's New in This Version and submit for review.</li>
          <li>Typical review time: 24–48 hours for updates, 2–3 days for initial submission.</li>
        </ol>

        <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 mb-4 text-sm">
          <strong className="text-primary">Key identifiers — do not change:</strong>
          <div className="text-foreground mt-2 space-y-1">
            <div>iOS Bundle ID: <code className="bg-muted px-1 py-0.5 rounded text-primary">app.replit.raimzeal</code></div>
            <div>Apple Team ID: stored in EAS credentials — do not modify eas.json credentials section</div>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">5.2 Android Google Play (Planned Q3 2026)</h3>
        <ol className="list-decimal list-inside space-y-2 text-foreground text-sm mb-4 ml-4">
          <li>Create a Google Play Developer account ($25 one-time fee).</li>
          <li>Build: <code className="bg-muted px-1 py-0.5 rounded text-primary">eas build --profile production --platform android</code>.</li>
          <li>Submit: <code className="bg-muted px-1 py-0.5 rounded text-primary">eas submit --platform android --latest</code>.</li>
          <li>Complete Play Store listing (description, screenshots, privacy policy URL, data safety form).</li>
          <li>Initial review: typically 3–7 business days for new apps.</li>
        </ol>
        <p className="text-muted-foreground text-sm">
          Android package name: <code className="bg-muted px-1 py-0.5 rounded text-primary">com.econteur.raimzeal</code> — do not change.
        </p>
      </section>

      <section id="investor" className="mb-12">
        <h2 className="text-2xl font-bold text-foreground mb-4 pb-2 border-b border-border">6. Investor & Grant Strategy</h2>

        <p className="text-foreground leading-relaxed mb-4">
          RAIMZEAL's funding strategy is non-dilutive — grants and institutional partnerships, not
          venture capital. This protects the free-access mission permanently.
        </p>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">6.1 Priority Grant Sources</h3>
        <div className="space-y-3 mb-6">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="font-semibold text-foreground">NIH Small Business Innovation Research (SBIR)</div>
              <div className="text-xs font-semibold text-secondary bg-secondary/10 px-2 py-0.5 rounded">Phase I: up to $300K</div>
            </div>
            <div className="text-sm text-muted-foreground mb-2">
              NIH funds technology innovations with clinical health applications. RAIMZEAL's AI-personalized
              food therapy and preventive health modules are strong candidates. SBIR Phase I is
              approximately $300K for a 6-month feasibility study.
            </div>
            <div className="text-xs text-primary">grants.nih.gov/grants/funding/sbir.htm · Apply: ongoing</div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="font-semibold text-foreground">Robert Wood Johnson Foundation</div>
              <div className="text-xs font-semibold text-secondary bg-secondary/10 px-2 py-0.5 rounded">$50K–$500K</div>
            </div>
            <div className="text-sm text-muted-foreground mb-2">
              RWJF funds initiatives that advance health equity. RAIMZEAL's free access model and
              culturally adaptive nutrition module directly align with their Health Equity focus area.
            </div>
            <div className="text-xs text-primary">rwjf.org · Apply through targeted RFPs</div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="font-semibold text-foreground">Gates Foundation — Global Health</div>
              <div className="text-xs font-semibold text-secondary bg-secondary/10 px-2 py-0.5 rounded">$100K–$2M</div>
            </div>
            <div className="text-sm text-muted-foreground mb-2">
              Gates funds preventive health tools for low- and middle-income countries. RAIMZEAL's
              smartphone-accessible, free model and cultural adaptability are core differentiators.
              Gates accepts unsolicited proposals through their Global Health Discovery program.
            </div>
            <div className="text-xs text-primary">gatesfoundation.org/about/how-we-work/general-purpose-grants-program</div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="font-semibold text-foreground">CDC Prevention Research Centers</div>
              <div className="text-xs font-semibold text-secondary bg-secondary/10 px-2 py-0.5 rounded">$100K–$1M</div>
            </div>
            <div className="text-sm text-muted-foreground mb-2">
              CDC's Prevention Research Center program funds community-based health promotion
              interventions. RAIMZEAL's community features and preventive care module are strong fits.
            </div>
            <div className="text-xs text-primary">cdc.gov/prc · Annual RFA cycle (typically August)</div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="font-semibold text-foreground">Apple App Store Small Business Program</div>
              <div className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">In-kind: 15% commission reduction</div>
            </div>
            <div className="text-sm text-muted-foreground mb-2">
              While RAIMZEAL has no in-app purchases, Apple's Small Business Program provides
              developer support, marketing opportunities, and access to Apple Health partnerships.
              Apply after the app goes live.
            </div>
            <div className="text-xs text-primary">developer.apple.com/app-store/small-business-program</div>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">6.2 Institutional Partnership Strategy</h3>
        <p className="text-foreground leading-relaxed mb-3">
          Institutional partnerships provide in-kind support, credibility, and user acquisition without
          requiring user monetization. Priority targets:
        </p>
        <ul className="list-disc list-inside space-y-2 text-foreground text-sm mb-4 ml-4">
          <li><strong>Hospital systems:</strong> Partner as a free patient wellness tool. Hospitals benefit from patient engagement and readmission reduction. RAIMZEAL benefits from clinical validation and user acquisition.</li>
          <li><strong>HBCUs and minority-serving universities:</strong> Student wellness programs. Campus licenses are free; institutions provide research access.</li>
          <li><strong>Community health centers (FQHCs):</strong> Federally Qualified Health Centers serve underserved populations. RAIMZEAL as a complementary tool aligns with their mission.</li>
          <li><strong>Corporate wellness programs:</strong> Large employers offer RAIMZEAL to employees as a free health benefit. Employers pay nothing; RAIMZEAL gains users and potential grant credibility.</li>
        </ul>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">6.3 Grant Application Timeline</h3>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted border-b border-border">
                <th className="text-left p-3 font-semibold text-muted-foreground">Milestone</th>
                <th className="text-left p-3 font-semibold text-muted-foreground">Target</th>
                <th className="text-left p-3 font-semibold text-muted-foreground">Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border"><td className="p-3 text-foreground">iOS live on App Store</td><td className="p-3 text-muted-foreground">Q2 2026</td><td className="p-3 text-muted-foreground">Required for most grant applications</td></tr>
              <tr className="border-b border-border"><td className="p-3 text-foreground">501(c)(3) application filed</td><td className="p-3 text-muted-foreground">Q3 2026</td><td className="p-3 text-muted-foreground">Required for most foundation grants</td></tr>
              <tr className="border-b border-border"><td className="p-3 text-foreground">First NIH SBIR submission</td><td className="p-3 text-muted-foreground">Q3 2026</td><td className="p-3 text-muted-foreground">Requires 501(c)(3) or SBIR-eligible entity</td></tr>
              <tr className="border-b border-border"><td className="p-3 text-foreground">RWJF letter of inquiry</td><td className="p-3 text-muted-foreground">Q4 2026</td><td className="p-3 text-muted-foreground">After first 10K users achieved</td></tr>
              <tr><td className="p-3 text-foreground">Gates Foundation proposal</td><td className="p-3 text-muted-foreground">H1 2027</td><td className="p-3 text-muted-foreground">Requires demonstrated user growth and outcomes data</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="nonprofit" className="mb-12">
        <h2 className="text-2xl font-bold text-foreground mb-4 pb-2 border-b border-border">7. 501(c)(3) Foundation Setup</h2>
        <p className="text-foreground leading-relaxed mb-4">
          Converting ECONTEUR LLC to or under a 501(c)(3) non-profit is the highest-priority
          governance milestone. It unlocks the majority of foundation grants, removes income tax
          obligations on grant revenue, and permanently protects the free-access mission.
        </p>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">7.1 Options</h3>
        <div className="space-y-3 mb-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="font-semibold text-primary mb-1">Option A: File a new 501(c)(3) (Recommended)</div>
            <div className="text-sm text-muted-foreground leading-relaxed">
              Incorporate a new non-profit corporation (e.g. "RAIMZEAL Health Foundation") in your
              state. ECONTEUR LLC licenses the RAIMZEAL platform to the foundation for $0/year.
              The foundation holds all grant revenue and mission commitments. ECONTEUR LLC can remain
              as the technology developer under a service agreement.
            </div>
            <div className="text-xs text-muted-foreground mt-2">Estimated cost: $300–$1,000 in state filing fees + $600 IRS Form 1023 application fee (1023-EZ: $275 if eligible)</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="font-semibold text-foreground mb-1">Option B: Convert ECONTEUR LLC to a non-profit</div>
            <div className="text-sm text-muted-foreground leading-relaxed">
              More complex. LLCs cannot directly convert to 501(c)(3) in most states — typically
              requires dissolving the LLC and incorporating a new non-profit. Less recommended.
            </div>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">7.2 Step-by-Step: Option A</h3>
        <ol className="list-decimal list-inside space-y-3 text-foreground text-sm mb-4 ml-4">
          <li>
            <strong>Choose a state to incorporate</strong> — Delaware is most common for non-profits.
            Your home state is also fine. The state filing fee is typically $50–$200.
          </li>
          <li>
            <strong>Draft Articles of Incorporation</strong> — Must include a specific public benefit
            purpose statement, a dissolution clause that distributes assets to another 501(c)(3)
            upon dissolution, and a prohibition on private inurement. Use a non-profit attorney
            or a service like Harbor Compliance or Rocket Lawyer.
          </li>
          <li>
            <strong>Appoint a Board of Directors</strong> — Minimum 3 directors required by most
            states. At least one must be independent (not a paid staff member). Dr. Oviawe serves as
            Executive Director; recruit 2+ independent directors from the medical or technology sectors.
          </li>
          <li>
            <strong>File Articles of Incorporation</strong> with your state's Secretary of State office.
            Cost: $50–$200. Timeline: 1–4 weeks.
          </li>
          <li>
            <strong>Obtain an EIN (Employer Identification Number)</strong> from the IRS — free,
            takes minutes at irs.gov.
          </li>
          <li>
            <strong>Draft organizational bylaws</strong> — Govern how the board operates, votes, and
            handles conflicts of interest. Include a written conflict of interest policy (required by IRS).
          </li>
          <li>
            <strong>File IRS Form 1023 or 1023-EZ</strong> — Form 1023-EZ is available if projected
            annual gross receipts are under $50,000 for the first 3 years. Fee: $275 (EZ) or $600
            (full 1023). Processing time: 2–6 weeks (EZ) or 3–6 months (full form).
          </li>
          <li>
            <strong>Register in your state</strong> for charitable solicitation if you plan to solicit
            donations publicly. Most states require registration before accepting donations.
          </li>
          <li>
            <strong>Open a non-profit bank account</strong> — Required before receiving any grant funds.
          </li>
          <li>
            <strong>Execute a license agreement</strong> — ECONTEUR LLC licenses the RAIMZEAL
            platform, codebase, and brand to the foundation at $0/year with a mission-lock clause.
          </li>
        </ol>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">7.3 Required Documents Checklist</h3>
        <div className="space-y-2 mb-4">
          {[
            "Articles of Incorporation (filed and stamped by Secretary of State)",
            "Federal EIN confirmation letter (IRS SS-4)",
            "Organizational bylaws",
            "Conflict of interest policy",
            "IRS Form 1023 or 1023-EZ application",
            "IRS determination letter (tax-exempt status confirmation)",
            "State charitable solicitation registration (if applicable)",
            "Board meeting minutes from organizational meeting",
            "Non-profit bank account setup",
            "Platform license agreement (ECONTEUR LLC → Foundation)",
          ].map((item) => (
            <div key={item} className="flex items-start gap-3 p-3 bg-card border border-border rounded-lg">
              <div className="w-4 h-4 border-2 border-border rounded mt-0.5 flex-shrink-0"></div>
              <div className="text-sm text-foreground">{item}</div>
            </div>
          ))}
        </div>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">7.4 Estimated Timeline</h3>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted border-b border-border">
                <th className="text-left p-3 font-semibold text-muted-foreground">Step</th>
                <th className="text-left p-3 font-semibold text-muted-foreground">Time Required</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border"><td className="p-3 text-foreground">Draft incorporation documents</td><td className="p-3 text-muted-foreground">1–2 weeks</td></tr>
              <tr className="border-b border-border"><td className="p-3 text-foreground">State filing and approval</td><td className="p-3 text-muted-foreground">2–4 weeks</td></tr>
              <tr className="border-b border-border"><td className="p-3 text-foreground">IRS EIN (immediate)</td><td className="p-3 text-muted-foreground">Same day</td></tr>
              <tr className="border-b border-border"><td className="p-3 text-foreground">IRS Form 1023-EZ (if eligible)</td><td className="p-3 text-muted-foreground">2–6 weeks after submission</td></tr>
              <tr className="border-b border-border"><td className="p-3 text-foreground">IRS Form 1023 full (if required)</td><td className="p-3 text-muted-foreground">3–6 months after submission</td></tr>
              <tr><td className="p-3 font-semibold text-foreground">Total (using 1023-EZ)</td><td className="p-3 font-semibold text-primary">~2–3 months</td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-muted-foreground text-sm">
          Total cost: approximately $400–$1,500 including state fees and IRS filing fee. Legal advice
          from a non-profit attorney ($500–$2,000) is strongly recommended for the Articles of
          Incorporation and bylaws. Organizations like Lawyers for the Creative Arts or volunteer
          legal services may be available at reduced cost.
        </p>
      </section>

      <section id="incident" className="mb-12">
        <h2 className="text-2xl font-bold text-foreground mb-4 pb-2 border-b border-border">8. Incident Response</h2>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">8.1 API Outage</h3>
        <ol className="list-decimal list-inside space-y-1 text-foreground text-sm mb-4 ml-4">
          <li>Check Replit deployment status — is the deployment running? If not, restart the deployment from the Replit dashboard.</li>
          <li>Check for recent code changes — if a deploy caused the outage, roll back to the previous version from Replit's deployment history.</li>
          <li>Check Supabase status at status.supabase.com — outage may be on their end.</li>
          <li>Review server logs in Replit for error messages.</li>
          <li>If unresolvable within 30 minutes, post a status update to the RAIMZEAL community feed.</li>
        </ol>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">8.2 Data Breach Protocol</h3>
        <ol className="list-decimal list-inside space-y-1 text-foreground text-sm mb-4 ml-4">
          <li>Immediately rotate all Supabase API keys and invalidate all active sessions.</li>
          <li>Disable the Supabase anon key used in client-side code and generate a new one.</li>
          <li>Assess the scope — which tables were affected, what data was accessed.</li>
          <li>If personal health data was compromised, notify affected users within 72 hours (GDPR requirement) and within 60 days (HIPAA, if applicable).</li>
          <li>File a report with the FTC and relevant state authorities if more than 500 residents of a US state are affected.</li>
          <li>Document the incident, remediation steps, and preventive measures.</li>
        </ol>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">8.3 Inappropriate Content</h3>
        <ol className="list-decimal list-inside space-y-1 text-foreground text-sm mb-4 ml-4">
          <li>Any user can report community content using the in-app report button.</li>
          <li>Review reported content within 24 hours.</li>
          <li>For content that violates community guidelines: delete the content, send a warning to the user.</li>
          <li>For repeated violations: restrict the user account.</li>
          <li>For illegal content (CSAM, credible threats): report to NCMEC or FBI as required, preserve evidence, delete the content, and permanently ban the account.</li>
        </ol>
      </section>

      <section id="scaling" className="mb-12">
        <h2 className="text-2xl font-bold text-foreground mb-4 pb-2 border-b border-border">9. Scaling Plan</h2>
        <p className="text-foreground leading-relaxed mb-4">
          RAIMZEAL is built to scale cost-effectively. The current infrastructure supports ~50,000
          monthly active users with no additional cost. Here is the plan for each growth tier:
        </p>

        <div className="space-y-4 mb-4">
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="font-bold text-foreground text-lg">0 – 50,000 MAU</div>
              <div className="text-secondary font-semibold">Current setup: ~$51/month</div>
            </div>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
              <li>Supabase Free tier handles this range (500MB storage, 50K MAU)</li>
              <li>Replit Starter plan is sufficient</li>
              <li>No infrastructure changes required</li>
            </ul>
          </div>

          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="font-bold text-foreground text-lg">50,000 – 500,000 MAU</div>
              <div className="text-primary font-semibold">~$100–$200/month</div>
            </div>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
              <li>Upgrade Supabase to Pro ($25/month) — supports 100K MAU, 8GB storage</li>
              <li>Upgrade Replit to Hacker plan or enable Autoscale ($7/month + compute)</li>
              <li>Enable Supabase read replicas for performance</li>
              <li>Monitor OpenAI API costs — implement response caching for common meal plan types</li>
            </ul>
          </div>

          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="font-bold text-foreground text-lg">500,000 – 5M MAU</div>
              <div className="text-primary font-semibold">~$500–$2,000/month</div>
            </div>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
              <li>Supabase Team plan ($599/month) — unlimited MAU, 100GB storage, dedicated resources</li>
              <li>Move API server to a dedicated cloud provider (AWS, GCP, or Fly.io) for cost efficiency at scale</li>
              <li>Implement Redis caching layer for API responses</li>
              <li>CDN for static assets and meal plan images (Cloudflare free tier)</li>
              <li>At this scale, grant funding is likely sufficient to cover infrastructure; apply for AWS Nonprofit Credits ($2,000/year)</li>
            </ul>
          </div>

          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="font-bold text-foreground text-lg">5M+ MAU</div>
              <div className="text-primary font-semibold">Dedicated engineering required</div>
            </div>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
              <li>Hire at least one full-time platform engineer (grant-funded)</li>
              <li>Full cloud migration with horizontal scaling</li>
              <li>Implement a formal SRE (Site Reliability Engineering) practice</li>
              <li>At this level of impact, RAIMZEAL would qualify for major WHO partnership support</li>
            </ul>
          </div>
        </div>
      </section>

      <div className="pt-8 border-t border-border text-xs text-muted-foreground text-center">
        RAIMZEAL Operations Guide · v1.3.0 · ECONTEUR LLC · June 2026 · raimzeal.com
      </div>
    </div>
  );
}
