export default function DeveloperGuide() {
  return (
    <div className="max-w-4xl mx-auto px-8 py-12">
      <div className="mb-8">
        <div className="text-xs font-semibold text-secondary uppercase tracking-widest mb-2">Guide 2</div>
        <h1 className="text-4xl font-bold text-foreground mb-3">Developer Guide</h1>
        <p className="text-muted-foreground text-lg">
          Technical reference for engineers building on or contributing to the RAIMZEAL platform.
          Covers architecture, API, mobile, database, auth, and deployment.
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
          <li><a href="#architecture" className="hover:underline">1. Architecture Overview</a></li>
          <li><a href="#prerequisites" className="hover:underline">2. Prerequisites & Setup</a></li>
          <li><a href="#running" className="hover:underline">3. Running the Project</a></li>
          <li><a href="#api" className="hover:underline">4. API Reference</a></li>
          <li><a href="#database" className="hover:underline">5. Database</a></li>
          <li><a href="#auth" className="hover:underline">6. Authentication</a></li>
          <li><a href="#mobile" className="hover:underline">7. Mobile App (Expo)</a></li>
          <li><a href="#deployment" className="hover:underline">8. Deployment</a></li>
          <li><a href="#contributing" className="hover:underline">9. Contributing</a></li>
        </ol>
      </nav>

      <section id="architecture" className="mb-12">
        <h2 className="text-2xl font-bold text-foreground mb-4 pb-2 border-b border-border">1. Architecture Overview</h2>
        <p className="text-foreground leading-relaxed mb-4">
          RAIMZEAL is a pnpm monorepo. All artifacts live under <code className="bg-muted px-1 py-0.5 rounded text-sm text-primary">artifacts/</code>,
          shared libraries under <code className="bg-muted px-1 py-0.5 rounded text-sm text-primary">lib/</code>.
          Each artifact is independently built and deployed via its own workflow.
        </p>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">1.1 Monorepo Structure</h3>
        <div className="bg-muted rounded-lg p-4 font-mono text-sm text-foreground mb-4 overflow-x-auto">
          <div className="whitespace-pre">{`workspace/
├── artifacts/
│   ├── api-server/        # Express 5 REST API
│   ├── raimzeal/          # React + Vite web app
│   ├── raimzeal-mobile/   # Expo SDK 54 mobile app
│   ├── raimzeal-pitch/    # Investor presentation (slides)
│   ├── raimzeal-docs/     # Documentation suite (this app)
│   └── raimzeal-video/    # Marketing video
├── lib/
│   ├── db/                # Drizzle ORM schema + Supabase client
│   └── api-spec/          # OpenAPI spec + codegen outputs
├── scripts/               # Shared utility scripts
├── pnpm-workspace.yaml    # Catalog pins and workspace config
└── tsconfig.base.json     # Shared TypeScript strict defaults`}</div>
        </div>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">1.2 Service Map</h3>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted border-b border-border">
                <th className="text-left p-3 font-semibold text-muted-foreground">Service</th>
                <th className="text-left p-3 font-semibold text-muted-foreground">Package</th>
                <th className="text-left p-3 font-semibold text-muted-foreground">Path</th>
                <th className="text-left p-3 font-semibold text-muted-foreground">Tech</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border">
                <td className="p-3 text-foreground font-medium">REST API</td>
                <td className="p-3 text-primary font-mono">@workspace/api-server</td>
                <td className="p-3 text-muted-foreground">/api</td>
                <td className="p-3 text-muted-foreground">Express 5, Drizzle ORM</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 text-foreground font-medium">Web App</td>
                <td className="p-3 text-primary font-mono">@workspace/raimzeal</td>
                <td className="p-3 text-muted-foreground">/</td>
                <td className="p-3 text-muted-foreground">React, Vite, TailwindCSS</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 text-foreground font-medium">Mobile App</td>
                <td className="p-3 text-primary font-mono">@workspace/raimzeal-mobile</td>
                <td className="p-3 text-muted-foreground">Expo dev server</td>
                <td className="p-3 text-muted-foreground">Expo SDK 54, React Native</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 text-foreground font-medium">Database</td>
                <td className="p-3 text-primary font-mono">@workspace/db</td>
                <td className="p-3 text-muted-foreground">Supabase (cloud)</td>
                <td className="p-3 text-muted-foreground">PostgreSQL, Drizzle ORM</td>
              </tr>
              <tr>
                <td className="p-3 text-foreground font-medium">API Spec</td>
                <td className="p-3 text-primary font-mono">@workspace/api-spec</td>
                <td className="p-3 text-muted-foreground">—</td>
                <td className="p-3 text-muted-foreground">OpenAPI 3.1, Orval codegen</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">1.3 Data Flow</h3>
        <p className="text-foreground leading-relaxed mb-3">
          All client-server communication goes through the REST API. The web and mobile apps both
          use React Query hooks generated by Orval from the OpenAPI spec. The API server authenticates
          requests using Supabase JWT tokens and queries the Supabase PostgreSQL database through
          Drizzle ORM.
        </p>
        <div className="bg-muted rounded-lg p-4 font-mono text-sm text-foreground mb-4">
          <div className="whitespace-pre">{`Client (Web / Mobile)
    │
    ├─ Auth: Supabase client SDK (JWT issuance)
    │
    └─ API calls: React Query hooks → /api/*
              │
              ├─ Auth middleware: validates Supabase JWT
              │
              └─ Database: Drizzle ORM → Supabase PostgreSQL`}</div>
        </div>
      </section>

      <section id="prerequisites" className="mb-12">
        <h2 className="text-2xl font-bold text-foreground mb-4 pb-2 border-b border-border">2. Prerequisites & Setup</h2>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">2.1 Required Tools</h3>
        <ul className="list-disc list-inside space-y-1 text-foreground text-sm mb-4 ml-4">
          <li>Node.js 20+ (LTS recommended)</li>
          <li>pnpm 9+ (workspace package manager)</li>
          <li>Expo CLI: <code className="bg-muted px-1 py-0.5 rounded text-primary">npm install -g eas-cli</code></li>
          <li>Git</li>
          <li>A Supabase account (free tier is sufficient for development)</li>
        </ul>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">2.2 Environment Variables</h3>
        <p className="text-foreground leading-relaxed mb-3">
          Environment variables are managed through Replit Secrets. The following are required:
        </p>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted border-b border-border">
                <th className="text-left p-3 font-semibold text-muted-foreground">Variable</th>
                <th className="text-left p-3 font-semibold text-muted-foreground">Used By</th>
                <th className="text-left p-3 font-semibold text-muted-foreground">Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border"><td className="p-3 font-mono text-primary text-xs">SUPABASE_URL</td><td className="p-3 text-muted-foreground">API, Mobile, Web</td><td className="p-3 text-muted-foreground">Your Supabase project URL</td></tr>
              <tr className="border-b border-border"><td className="p-3 font-mono text-primary text-xs">SUPABASE_ANON_KEY</td><td className="p-3 text-muted-foreground">API, Mobile, Web</td><td className="p-3 text-muted-foreground">Public anon key (safe for client)</td></tr>
              <tr className="border-b border-border"><td className="p-3 font-mono text-primary text-xs">SUPABASE_SERVICE_ROLE_KEY</td><td className="p-3 text-muted-foreground">API only</td><td className="p-3 text-muted-foreground">Never expose to client</td></tr>
              <tr className="border-b border-border"><td className="p-3 font-mono text-primary text-xs">OPENAI_API_KEY</td><td className="p-3 text-muted-foreground">API only</td><td className="p-3 text-muted-foreground">For meal plan + fitness AI generation</td></tr>
              <tr className="border-b border-border"><td className="p-3 font-mono text-primary text-xs">EXPO_TOKEN</td><td className="p-3 text-muted-foreground">EAS builds</td><td className="p-3 text-muted-foreground">EAS project access token</td></tr>
              <tr><td className="p-3 font-mono text-primary text-xs">DATABASE_URL</td><td className="p-3 text-muted-foreground">API (migrations)</td><td className="p-3 text-muted-foreground">PostgreSQL connection string for Drizzle</td></tr>
            </tbody>
          </table>
        </div>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">2.3 First-Time Setup</h3>
        <div className="bg-muted rounded-lg p-4 font-mono text-sm text-foreground mb-4">
          <div className="whitespace-pre">{`# Clone the repo
git clone <repo-url>
cd workspace

# Install all workspace dependencies
pnpm install

# Run database migrations
pnpm --filter @workspace/api-server run db:migrate

# Typecheck everything
pnpm run typecheck`}</div>
        </div>
      </section>

      <section id="running" className="mb-12">
        <h2 className="text-2xl font-bold text-foreground mb-4 pb-2 border-b border-border">3. Running the Project</h2>

        <p className="text-foreground leading-relaxed mb-4">
          On Replit, each artifact has its own workflow that starts automatically. Locally, you can
          start individual services with pnpm filter commands.
        </p>

        <div className="space-y-3 mb-4">
          <div className="bg-muted rounded-lg p-4 font-mono text-sm text-foreground">
            <div className="text-muted-foreground text-xs mb-1"># Start API server</div>
            <div>pnpm --filter @workspace/api-server run dev</div>
          </div>
          <div className="bg-muted rounded-lg p-4 font-mono text-sm text-foreground">
            <div className="text-muted-foreground text-xs mb-1"># Start web app</div>
            <div>pnpm --filter @workspace/raimzeal run dev</div>
          </div>
          <div className="bg-muted rounded-lg p-4 font-mono text-sm text-foreground">
            <div className="text-muted-foreground text-xs mb-1"># Start mobile app (Expo)</div>
            <div>pnpm --filter @workspace/raimzeal-mobile run dev</div>
          </div>
          <div className="bg-muted rounded-lg p-4 font-mono text-sm text-foreground">
            <div className="text-muted-foreground text-xs mb-1"># Run all typechecks</div>
            <div>pnpm run typecheck</div>
          </div>
          <div className="bg-muted rounded-lg p-4 font-mono text-sm text-foreground">
            <div className="text-muted-foreground text-xs mb-1"># Regenerate API client from OpenAPI spec</div>
            <div>pnpm --filter @workspace/api-spec run codegen</div>
          </div>
        </div>
      </section>

      <section id="api" className="mb-12">
        <h2 className="text-2xl font-bold text-foreground mb-4 pb-2 border-b border-border">4. API Reference</h2>
        <p className="text-foreground leading-relaxed mb-4">
          The RAIMZEAL API is a contract-first REST API defined in OpenAPI 3.1. All endpoints live
          under the <code className="bg-muted px-1 py-0.5 rounded text-sm text-primary">/api</code> path prefix.
          The OpenAPI spec is the source of truth — do not modify generated files directly.
        </p>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">4.1 Authentication</h3>
        <p className="text-foreground leading-relaxed mb-3">
          All authenticated endpoints require a Supabase JWT in the Authorization header:
        </p>
        <div className="bg-muted rounded-lg p-4 font-mono text-sm text-foreground mb-4">
          <div>Authorization: Bearer &lt;supabase-jwt&gt;</div>
        </div>
        <p className="text-foreground leading-relaxed mb-3">
          The API server validates the JWT against Supabase's JWKS endpoint. Unauthenticated requests
          to protected routes return <code className="bg-muted px-1 py-0.5 rounded text-sm text-primary">401 Unauthorized</code>.
        </p>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">4.2 Core Endpoints</h3>
        <div className="space-y-3 mb-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-secondary/20 text-secondary text-xs font-bold px-2 py-0.5 rounded">GET</span>
              <code className="text-sm font-mono text-foreground">/api/healthz</code>
              <span className="text-xs text-muted-foreground ml-auto">Public</span>
            </div>
            <div className="text-sm text-muted-foreground">Health check endpoint. Returns 200 OK with server status.</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-secondary/20 text-secondary text-xs font-bold px-2 py-0.5 rounded">GET</span>
              <code className="text-sm font-mono text-foreground">/api/users/me</code>
              <span className="text-xs text-muted-foreground ml-auto">Auth required</span>
            </div>
            <div className="text-sm text-muted-foreground">Returns the authenticated user's profile and preferences.</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-primary/20 text-primary text-xs font-bold px-2 py-0.5 rounded">POST</span>
              <code className="text-sm font-mono text-foreground">/api/meal-plans/generate</code>
              <span className="text-xs text-muted-foreground ml-auto">Auth required</span>
            </div>
            <div className="text-sm text-muted-foreground">Generates a personalized weekly meal plan using OpenAI. Returns a structured meal plan object.</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-secondary/20 text-secondary text-xs font-bold px-2 py-0.5 rounded">GET</span>
              <code className="text-sm font-mono text-foreground">/api/fitness/programs</code>
              <span className="text-xs text-muted-foreground ml-auto">Auth required</span>
            </div>
            <div className="text-sm text-muted-foreground">Returns fitness programs filtered by the user's profile and goals.</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-primary/20 text-primary text-xs font-bold px-2 py-0.5 rounded">POST</span>
              <code className="text-sm font-mono text-foreground">/api/community/posts</code>
              <span className="text-xs text-muted-foreground ml-auto">Auth required</span>
            </div>
            <div className="text-sm text-muted-foreground">Creates a new community post. Body: {`{ content, type, media_urls?, visibility }`}.</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-primary/20 text-primary text-xs font-bold px-2 py-0.5 rounded">POST</span>
              <code className="text-sm font-mono text-foreground">/api/health-logs</code>
              <span className="text-xs text-muted-foreground ml-auto">Auth required</span>
            </div>
            <div className="text-sm text-muted-foreground">Logs a health event (workout, meal, mood, sleep). Type field determines the log category.</div>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">4.3 OpenAPI Codegen</h3>
        <p className="text-foreground leading-relaxed mb-3">
          The API spec lives at <code className="bg-muted px-1 py-0.5 rounded text-sm text-primary">lib/api-spec/openapi.yaml</code>.
          After modifying the spec, run codegen to regenerate React Query hooks and Zod schemas:
        </p>
        <div className="bg-muted rounded-lg p-4 font-mono text-sm text-foreground mb-4">
          <div>pnpm --filter @workspace/api-spec run codegen</div>
        </div>
        <p className="text-muted-foreground text-sm">
          Generated files are in <code className="bg-muted px-1 py-0.5 rounded text-xs">lib/api-spec/src/generated/</code>.
          Do not edit them manually — they will be overwritten on next codegen.
        </p>
      </section>

      <section id="database" className="mb-12">
        <h2 className="text-2xl font-bold text-foreground mb-4 pb-2 border-b border-border">5. Database</h2>
        <p className="text-foreground leading-relaxed mb-4">
          RAIMZEAL uses Supabase PostgreSQL with Drizzle ORM. The schema is defined in
          <code className="bg-muted px-1 py-0.5 rounded text-sm text-primary ml-1">lib/db/src/schema/</code>.
        </p>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">5.1 Core Tables</h3>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted border-b border-border">
                <th className="text-left p-3 font-semibold text-muted-foreground">Table</th>
                <th className="text-left p-3 font-semibold text-muted-foreground">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border"><td className="p-3 font-mono text-primary text-xs">users</td><td className="p-3 text-muted-foreground">User accounts, synced from Supabase auth.users</td></tr>
              <tr className="border-b border-border"><td className="p-3 font-mono text-primary text-xs">user_profiles</td><td className="p-3 text-muted-foreground">Health profile: goals, dietary prefs, activity level, conditions</td></tr>
              <tr className="border-b border-border"><td className="p-3 font-mono text-primary text-xs">health_logs</td><td className="p-3 text-muted-foreground">All user health events (workouts, meals, mood, sleep)</td></tr>
              <tr className="border-b border-border"><td className="p-3 font-mono text-primary text-xs">meal_plans</td><td className="p-3 text-muted-foreground">Generated meal plans, stored as JSONB</td></tr>
              <tr className="border-b border-border"><td className="p-3 font-mono text-primary text-xs">fitness_programs</td><td className="p-3 text-muted-foreground">Program catalog with exercises, sets, reps</td></tr>
              <tr className="border-b border-border"><td className="p-3 font-mono text-primary text-xs">community_posts</td><td className="p-3 text-muted-foreground">User-generated community content</td></tr>
              <tr className="border-b border-border"><td className="p-3 font-mono text-primary text-xs">post_reactions</td><td className="p-3 text-muted-foreground">Likes and reactions on community posts</td></tr>
              <tr><td className="p-3 font-mono text-primary text-xs">comments</td><td className="p-3 text-muted-foreground">Comments on community posts</td></tr>
            </tbody>
          </table>
        </div>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">5.2 Running Migrations</h3>
        <div className="space-y-2 mb-4">
          <div className="bg-muted rounded-lg p-4 font-mono text-sm text-foreground">
            <div className="text-muted-foreground text-xs mb-1"># Generate a new migration</div>
            <div>pnpm --filter @workspace/api-server run db:generate</div>
          </div>
          <div className="bg-muted rounded-lg p-4 font-mono text-sm text-foreground">
            <div className="text-muted-foreground text-xs mb-1"># Apply migrations to the database</div>
            <div>pnpm --filter @workspace/api-server run db:migrate</div>
          </div>
          <div className="bg-muted rounded-lg p-4 font-mono text-sm text-foreground">
            <div className="text-muted-foreground text-xs mb-1"># Open Drizzle Studio (database browser)</div>
            <div>pnpm --filter @workspace/api-server run db:studio</div>
          </div>
        </div>

        <div className="bg-muted rounded-lg p-4 text-sm text-muted-foreground">
          <strong className="text-foreground">Row Level Security:</strong> All production tables have RLS enabled.
          Users can only read and write their own rows. The service role key bypasses RLS and must never
          be exposed to clients. Always use the anon key in client-side code.
        </div>
      </section>

      <section id="auth" className="mb-12">
        <h2 className="text-2xl font-bold text-foreground mb-4 pb-2 border-b border-border">6. Authentication</h2>
        <p className="text-foreground leading-relaxed mb-4">
          RAIMZEAL authentication is handled by Supabase Auth. All OAuth flows (Apple, Google) are
          configured in the Supabase dashboard and handled by the Supabase client SDK.
        </p>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">6.1 Supabase Auth Setup</h3>
        <ul className="list-disc list-inside space-y-1 text-foreground text-sm mb-4 ml-4">
          <li>Apple Sign In is configured with the Apple Services ID and private key in Supabase Auth settings.</li>
          <li>Google OAuth is configured with a Google Cloud OAuth client in Supabase Auth settings.</li>
          <li>Email/password auth is enabled with mandatory email verification.</li>
          <li>Anonymous sign-in is enabled for guest mode.</li>
        </ul>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">6.2 Apple Sign In (iOS Requirement)</h3>
        <p className="text-foreground leading-relaxed mb-3">
          Apple Sign In is mandatory for any iOS app that offers third-party OAuth login (App Store
          Guideline 4.8). RAIMZEAL implements this via the Expo
          <code className="bg-muted px-1 py-0.5 rounded text-sm text-primary mx-1">expo-apple-authentication</code>
          package on native and Supabase's OAuth redirect on web.
        </p>
        <p className="text-muted-foreground text-sm mb-4">
          The Apple Services ID must match the bundle ID:
          <code className="bg-muted px-1 py-0.5 rounded text-sm text-primary ml-1">app.replit.raimzeal</code> (iOS).
          Do not change the bundle ID — see the iOS Bundle ID Decision memory note.
        </p>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">6.3 Server-Side JWT Validation</h3>
        <div className="bg-muted rounded-lg p-4 font-mono text-sm text-foreground mb-4">
          <div className="whitespace-pre">{`// Auth middleware (api-server/src/middleware/auth.ts)
import { createClient } from '@supabase/supabase-js';

export async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });

  req.user = user;
  next();
}`}</div>
        </div>
      </section>

      <section id="mobile" className="mb-12">
        <h2 className="text-2xl font-bold text-foreground mb-4 pb-2 border-b border-border">7. Mobile App (Expo)</h2>
        <p className="text-foreground leading-relaxed mb-4">
          The mobile app uses Expo SDK 54 with Expo Router for file-based navigation. It targets
          iOS 16+ and Android 10+ (targetSdk 35).
        </p>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">7.1 Key Dependencies</h3>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted border-b border-border">
                <th className="text-left p-3 font-semibold text-muted-foreground">Package</th>
                <th className="text-left p-3 font-semibold text-muted-foreground">Purpose</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border"><td className="p-3 font-mono text-primary text-xs">expo-router</td><td className="p-3 text-muted-foreground">File-based navigation (v4)</td></tr>
              <tr className="border-b border-border"><td className="p-3 font-mono text-primary text-xs">@supabase/supabase-js</td><td className="p-3 text-muted-foreground">Auth + database client</td></tr>
              <tr className="border-b border-border"><td className="p-3 font-mono text-primary text-xs">expo-apple-authentication</td><td className="p-3 text-muted-foreground">Apple Sign In (required for iOS)</td></tr>
              <tr className="border-b border-border"><td className="p-3 font-mono text-primary text-xs">expo-auth-session</td><td className="p-3 text-muted-foreground">Google OAuth on mobile</td></tr>
              <tr className="border-b border-border"><td className="p-3 font-mono text-primary text-xs">@tanstack/react-query</td><td className="p-3 text-muted-foreground">Data fetching + caching</td></tr>
              <tr className="border-b border-border"><td className="p-3 font-mono text-primary text-xs">nativewind</td><td className="p-3 text-muted-foreground">Tailwind CSS for React Native</td></tr>
              <tr><td className="p-3 font-mono text-primary text-xs">expo-camera</td><td className="p-3 text-muted-foreground">Food barcode scanning and photo logging</td></tr>
            </tbody>
          </table>
        </div>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">7.2 EAS Build Commands</h3>
        <div className="space-y-2 mb-4">
          <div className="bg-muted rounded-lg p-4 font-mono text-sm text-foreground">
            <div className="text-muted-foreground text-xs mb-1"># Development build (local simulator)</div>
            <div>eas build --profile development --platform ios</div>
          </div>
          <div className="bg-muted rounded-lg p-4 font-mono text-sm text-foreground">
            <div className="text-muted-foreground text-xs mb-1"># Preview build (TestFlight / internal testing)</div>
            <div>eas build --profile preview --platform ios</div>
          </div>
          <div className="bg-muted rounded-lg p-4 font-mono text-sm text-foreground">
            <div className="text-muted-foreground text-xs mb-1"># Production build (App Store)</div>
            <div>eas build --profile production --platform ios</div>
          </div>
          <div className="bg-muted rounded-lg p-4 font-mono text-sm text-foreground">
            <div className="text-muted-foreground text-xs mb-1"># Submit to App Store (after production build)</div>
            <div>eas submit --platform ios --latest</div>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">7.3 App Configuration</h3>
        <ul className="list-disc list-inside space-y-1 text-foreground text-sm mb-4 ml-4">
          <li>iOS Bundle ID: <code className="bg-muted px-1 py-0.5 rounded text-primary">app.replit.raimzeal</code> — do not change</li>
          <li>Android Package: <code className="bg-muted px-1 py-0.5 rounded text-primary">com.econteur.raimzeal</code> — do not change</li>
          <li>iOS targetSdk: 16+ (iOS 16 minimum)</li>
          <li>Android targetSdk: 35 (Android 10+ minimum)</li>
          <li>Permissions: Camera, Microphone (fitness audio), Location (optional), Activity Recognition (Android step count)</li>
        </ul>
      </section>

      <section id="deployment" className="mb-12">
        <h2 className="text-2xl font-bold text-foreground mb-4 pb-2 border-b border-border">8. Deployment</h2>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">8.1 API Server & Web App</h3>
        <p className="text-foreground leading-relaxed mb-3">
          Both the API server and web app deploy to Replit's production environment via the Replit
          deployment system. From the Replit workspace, click <strong>Deploy</strong> to publish the
          current state to a <code className="bg-muted px-1 py-0.5 rounded text-sm text-primary">.replit.app</code> domain.
        </p>
        <ul className="list-disc list-inside space-y-1 text-foreground text-sm mb-4 ml-4">
          <li>Production runs on Replit Autoscale deployments.</li>
          <li>Environment variables are set separately in the deployment environment.</li>
          <li>The healthcheck endpoint <code className="bg-muted px-1 py-0.5 rounded text-primary">/api/healthz</code> is polled to confirm the deployment is live.</li>
          <li>Deployment cost: ~$19/month on the Replit Starter plan.</li>
        </ul>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">8.2 Mobile App Store Submission</h3>
        <ol className="list-decimal list-inside space-y-2 text-foreground text-sm mb-4 ml-4">
          <li>Bump the version in <code className="bg-muted px-1 py-0.5 rounded text-primary">app.json</code> (version + buildNumber).</li>
          <li>Run <code className="bg-muted px-1 py-0.5 rounded text-primary">eas build --profile production --platform ios</code>.</li>
          <li>Wait for EAS to complete the build (typically 15–25 minutes).</li>
          <li>Run <code className="bg-muted px-1 py-0.5 rounded text-primary">eas submit --platform ios --latest</code>.</li>
          <li>Log in to App Store Connect and complete the submission metadata.</li>
          <li>Submit for review. First submissions typically take 24–48 hours. Updates are usually faster.</li>
        </ol>
        <p className="text-muted-foreground text-sm">
          Note: EAS build must be run from a machine with Git — Replit blocks direct git commands.
          Use a local machine or GitHub Actions CI for EAS builds. See the EAS Store Submission
          memory note for the complete procedure.
        </p>
      </section>

      <section id="contributing" className="mb-12">
        <h2 className="text-2xl font-bold text-foreground mb-4 pb-2 border-b border-border">9. Contributing</h2>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">9.1 Branch Strategy</h3>
        <ul className="list-disc list-inside space-y-1 text-foreground text-sm mb-4 ml-4">
          <li><code className="bg-muted px-1 py-0.5 rounded text-primary">main</code> — production branch, always deployable</li>
          <li>Feature branches: <code className="bg-muted px-1 py-0.5 rounded text-primary">feature/&lt;description&gt;</code></li>
          <li>Bug fixes: <code className="bg-muted px-1 py-0.5 rounded text-primary">fix/&lt;description&gt;</code></li>
          <li>All PRs require passing typechecks before merge.</li>
        </ul>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">9.2 Code Standards</h3>
        <ul className="list-disc list-inside space-y-1 text-foreground text-sm mb-4 ml-4">
          <li>TypeScript strict mode is enforced — no <code className="bg-muted px-1 py-0.5 rounded text-primary">any</code> types.</li>
          <li>Never use <code className="bg-muted px-1 py-0.5 rounded text-primary">console.log</code> in server code — use <code className="bg-muted px-1 py-0.5 rounded text-primary">req.log</code> (in route handlers) or the singleton <code className="bg-muted px-1 py-0.5 rounded text-primary">logger</code>.</li>
          <li>API changes must be reflected in the OpenAPI spec first, then regenerate types.</li>
          <li>Database changes must include a Drizzle migration.</li>
          <li>All new routes must be protected with the <code className="bg-muted px-1 py-0.5 rounded text-primary">requireAuth</code> middleware unless explicitly public.</li>
        </ul>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">9.3 Pre-Commit Checklist</h3>
        <div className="bg-muted rounded-lg p-4 font-mono text-sm text-foreground mb-4">
          <div className="whitespace-pre">{`pnpm run typecheck          # Must pass with zero errors
pnpm run typecheck:libs    # If you changed lib/ packages
pnpm --filter @workspace/api-spec run codegen  # If you changed openapi.yaml`}</div>
        </div>
      </section>

      <div className="pt-8 border-t border-border text-xs text-muted-foreground text-center">
        RAIMZEAL Developer Guide · v1.3.0 · ECONTEUR LLC · June 2026 · raimzeal.com
      </div>
    </div>
  );
}
