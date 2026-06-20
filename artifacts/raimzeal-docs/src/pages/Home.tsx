import { Link } from "wouter";
import logoImg from "@assets/002FEB67-8D79-4211-94B8-51ECBB9D3E78_1781989043230.png";
import drImg from "@assets/IMG_1810_1781989043230.png";

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto px-8 py-12">
      <div className="flex items-center gap-6 mb-10">
        <img src={logoImg} alt="RAIMZEAL" className="h-14 w-auto" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">RAIMZEAL Documentation Suite</h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive guides for users, developers, and operators — Version 1.3.0 · June 2026
          </p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-6 mb-10">
        <div className="flex items-start gap-6">
          <img
            src={drImg}
            alt="Dr. Ephraim Oviawe"
            className="w-20 h-20 rounded-full object-cover object-top border-2 border-primary flex-shrink-0"
          />
          <div>
            <p className="text-base text-foreground leading-relaxed italic">
              "RAIMZEAL was built on a simple conviction: every person on earth deserves access to
              personalized, evidence-based health guidance — regardless of income, location, or
              insurance status. These documents capture everything you need to use, build on, and
              operate this platform."
            </p>
            <p className="text-sm text-primary font-semibold mt-3">
              Dr. Ephraim Oviawe — Founder, ECONTEUR LLC
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Link href="/user-guide">
          <div className="bg-card border border-border rounded-lg p-6 hover:border-primary transition-colors cursor-pointer group">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-semibold text-primary uppercase tracking-widest mb-2">
                  Guide 1
                </div>
                <h2 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors mb-2">
                  User Guide
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Everything a RAIMZEAL user needs to know — creating an account, navigating the
                  six health pillars, using AI-personalized programs, joining the community, and
                  protecting your privacy.
                </p>
                <div className="flex gap-2 mt-4">
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">Getting Started</span>
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">Features</span>
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">Privacy</span>
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">Troubleshooting</span>
                </div>
              </div>
              <div className="text-primary text-2xl ml-4 flex-shrink-0 group-hover:translate-x-1 transition-transform">→</div>
            </div>
          </div>
        </Link>

        <Link href="/developer-guide">
          <div className="bg-card border border-border rounded-lg p-6 hover:border-primary transition-colors cursor-pointer group">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-semibold text-secondary uppercase tracking-widest mb-2">
                  Guide 2
                </div>
                <h2 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors mb-2">
                  Developer Guide
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Complete technical reference for contributors and engineers — monorepo architecture,
                  API contracts, database schema, authentication flows, EAS builds, and App Store
                  submission procedures.
                </p>
                <div className="flex gap-2 mt-4">
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">Architecture</span>
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">API Reference</span>
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">Mobile</span>
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">Deployment</span>
                </div>
              </div>
              <div className="text-primary text-2xl ml-4 flex-shrink-0 group-hover:translate-x-1 transition-transform">→</div>
            </div>
          </div>
        </Link>

        <Link href="/operations-guide">
          <div className="bg-card border border-border rounded-lg p-6 hover:border-primary transition-colors cursor-pointer group">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-semibold text-chart-3 uppercase tracking-widest mb-2">
                  Guide 3
                </div>
                <h2 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors mb-2">
                  Operations Guide
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Dr. Oviawe's operations manual — monthly cost breakdown, maintenance schedule,
                  monitoring procedures, investor and grant strategy, 501(c)(3) foundation setup,
                  and the platform scaling plan.
                </p>
                <div className="flex gap-2 mt-4">
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">Costs</span>
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">Maintenance</span>
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">Investor Strategy</span>
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">501(c)(3)</span>
                </div>
              </div>
              <div className="text-primary text-2xl ml-4 flex-shrink-0 group-hover:translate-x-1 transition-transform">→</div>
            </div>
          </div>
        </Link>
      </div>

      <div className="mt-10 pt-8 border-t border-border">
        <div className="grid grid-cols-3 gap-6 text-center">
          <div>
            <div className="text-2xl font-bold text-primary">v1.3.0</div>
            <div className="text-sm text-muted-foreground mt-1">Current Version</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-secondary">3</div>
            <div className="text-sm text-muted-foreground mt-1">Platforms</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">$0</div>
            <div className="text-sm text-muted-foreground mt-1">Cost to Users</div>
          </div>
        </div>
      </div>

      <div className="mt-8 text-xs text-muted-foreground text-center">
        RAIMZEAL — ECONTEUR LLC · raimzeal.com · Confidential — June 2026
      </div>
    </div>
  );
}
