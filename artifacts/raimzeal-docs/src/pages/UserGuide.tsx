export default function UserGuide() {
  return (
    <div className="max-w-4xl mx-auto px-8 py-12">
      <div className="mb-8">
        <div className="text-xs font-semibold text-primary uppercase tracking-widest mb-2">Guide 1</div>
        <h1 className="text-4xl font-bold text-foreground mb-3">User Guide</h1>
        <p className="text-muted-foreground text-lg">
          Everything you need to get started and get the most from RAIMZEAL — your free, AI-powered
          health companion.
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
          <li><a href="#welcome" className="hover:underline">1. Welcome to RAIMZEAL</a></li>
          <li><a href="#getting-started" className="hover:underline">2. Getting Started</a></li>
          <li><a href="#dashboard" className="hover:underline">3. Your Health Dashboard</a></li>
          <li><a href="#fitness" className="hover:underline">4. Fitness Programs</a></li>
          <li><a href="#food" className="hover:underline">5. Food Therapy</a></li>
          <li><a href="#mental" className="hover:underline">6. Mental Wellness</a></li>
          <li><a href="#community" className="hover:underline">7. Community</a></li>
          <li><a href="#sleep" className="hover:underline">8. Sleep & Recovery</a></li>
          <li><a href="#preventive" className="hover:underline">9. Preventive Health</a></li>
          <li><a href="#privacy" className="hover:underline">10. Privacy & Your Data</a></li>
          <li><a href="#troubleshooting" className="hover:underline">11. Troubleshooting & Support</a></li>
        </ol>
      </nav>

      <section id="welcome" className="mb-12">
        <h2 className="text-2xl font-bold text-foreground mb-4 pb-2 border-b border-border">1. Welcome to RAIMZEAL</h2>
        <p className="text-foreground leading-relaxed mb-4">
          RAIMZEAL is a free, AI-powered health and wellness platform created by Dr. Ephraim Oviawe
          and ECONTEUR LLC. It delivers personalized guidance across six health disciplines — fitness,
          food therapy, mental wellness, community, sleep & recovery, and preventive care — all in
          one application, at no cost to you.
        </p>
        <p className="text-foreground leading-relaxed mb-4">
          RAIMZEAL was built on a conviction that every person — regardless of income, location, or
          insurance status — deserves access to high-quality, evidence-based health guidance. There
          are no subscriptions, no advertisements, no paywalls, and no plans to add them.
        </p>
        <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 mb-4">
          <div className="font-semibold text-primary mb-1">RAIMZEAL is free forever.</div>
          <div className="text-sm text-foreground">
            The platform operates as a non-profit initiative under ECONTEUR LLC. All features — past,
            present, and future — are available to every user at no charge.
          </div>
        </div>
        <p className="text-foreground leading-relaxed">
          RAIMZEAL is available on iOS, Android, and web. You can access it on any device. Your
          health data syncs automatically across all your devices when you are signed in.
        </p>
      </section>

      <section id="getting-started" className="mb-12">
        <h2 className="text-2xl font-bold text-foreground mb-4 pb-2 border-b border-border">2. Getting Started</h2>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">2.1 Creating Your Account</h3>
        <p className="text-foreground leading-relaxed mb-3">
          To use RAIMZEAL, you need a free account. Your account keeps your health data safe, synced
          across devices, and private. RAIMZEAL never sells your data and never shares it with
          advertisers.
        </p>
        <ol className="list-decimal list-inside space-y-2 text-foreground text-sm mb-4 ml-4">
          <li>Download RAIMZEAL from the App Store (iOS) or Google Play Store (Android), or visit the web app.</li>
          <li>Tap <strong>Get Started</strong> on the welcome screen.</li>
          <li>Choose your sign-in method (see below).</li>
          <li>Complete your health profile — this takes about 3 minutes and helps RAIMZEAL personalize your experience.</li>
          <li>You're in. Your dashboard is ready.</li>
        </ol>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">2.2 Sign-In Options</h3>
        <p className="text-foreground leading-relaxed mb-3">
          RAIMZEAL offers four ways to sign in. All options are equally secure. Choose whichever is
          most convenient for you.
        </p>
        <div className="space-y-3 mb-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="font-semibold text-foreground mb-1">Sign in with Apple</div>
            <div className="text-sm text-muted-foreground">
              Use your Apple ID. Apple Sign In gives you the option to hide your real email address —
              Apple will relay messages to your real inbox without sharing it. This is the most private
              option available.
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="font-semibold text-foreground mb-1">Sign in with Google</div>
            <div className="text-sm text-muted-foreground">
              Use your Google account. Quick and easy if you already use Google services. RAIMZEAL
              only requests your name and email — no access to Gmail, Drive, or other Google services.
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="font-semibold text-foreground mb-1">Email & Password</div>
            <div className="text-sm text-muted-foreground">
              Create an account with any email address and a password of your choice. You will receive
              a verification email. Your password is never stored in plain text.
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="font-semibold text-foreground mb-1">Guest / Anonymous Mode</div>
            <div className="text-sm text-muted-foreground">
              Browse RAIMZEAL without creating an account. Data is stored locally on your device. You
              can upgrade to a full account at any time without losing your data.
            </div>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">2.3 Setting Up Your Profile</h3>
        <p className="text-foreground leading-relaxed mb-3">
          RAIMZEAL uses your health profile to generate personalized recommendations. Your profile
          includes:
        </p>
        <ul className="list-disc list-inside space-y-1 text-foreground text-sm mb-4 ml-4">
          <li><strong>Basic information:</strong> age, biological sex, height, weight</li>
          <li><strong>Health goals:</strong> weight management, strength, mental wellness, better sleep, preventive health, or a combination</li>
          <li><strong>Activity level:</strong> sedentary, lightly active, moderately active, very active</li>
          <li><strong>Dietary preferences:</strong> omnivore, vegetarian, vegan, halal, kosher, gluten-free, or custom</li>
          <li><strong>Health conditions:</strong> optional — informs safe recommendations (e.g. diabetes, hypertension)</li>
          <li><strong>Cultural background:</strong> helps RAIMZEAL suggest culturally relevant meals and practices</li>
        </ul>
        <p className="text-muted-foreground text-sm">
          You can update any part of your profile at any time from Settings → My Profile.
        </p>
      </section>

      <section id="dashboard" className="mb-12">
        <h2 className="text-2xl font-bold text-foreground mb-4 pb-2 border-b border-border">3. Your Health Dashboard</h2>
        <p className="text-foreground leading-relaxed mb-4">
          The dashboard is your daily health home. It shows your progress across all six health pillars
          at a glance, surfaces your next recommended action, and celebrates your streaks and milestones.
        </p>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="font-semibold text-primary text-sm mb-1">Daily Ring</div>
            <div className="text-sm text-muted-foreground">
              A visual summary of your activity, nutrition, sleep, and mental wellness for today.
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="font-semibold text-primary text-sm mb-1">Next Action</div>
            <div className="text-sm text-muted-foreground">
              RAIMZEAL's AI picks the single most impactful action for you today based on your history.
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="font-semibold text-primary text-sm mb-1">Streaks</div>
            <div className="text-sm text-muted-foreground">
              Track your consistency across programs. Streaks reset at midnight in your local timezone.
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="font-semibold text-primary text-sm mb-1">Weekly Summary</div>
            <div className="text-sm text-muted-foreground">
              Every Sunday, RAIMZEAL generates a personal weekly health summary with insights and suggestions.
            </div>
          </div>
        </div>
      </section>

      <section id="fitness" className="mb-12">
        <h2 className="text-2xl font-bold text-foreground mb-4 pb-2 border-b border-border">4. Fitness Programs</h2>
        <p className="text-foreground leading-relaxed mb-4">
          RAIMZEAL's fitness module provides adaptive workout programs tailored to your goals, fitness
          level, available equipment, and time. No gym membership required — all programs include
          home-friendly options.
        </p>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">4.1 Browsing Programs</h3>
        <p className="text-foreground leading-relaxed mb-3">
          Navigate to <strong>Fitness</strong> from the bottom navigation bar. Browse programs by goal
          (strength, cardio, flexibility, weight loss, athletic performance) or let RAIMZEAL recommend
          one based on your profile. Each program shows:
        </p>
        <ul className="list-disc list-inside space-y-1 text-foreground text-sm mb-4 ml-4">
          <li>Duration (days/weeks)</li>
          <li>Difficulty level (Beginner, Intermediate, Advanced)</li>
          <li>Equipment needed (none, resistance bands, dumbbells, full gym)</li>
          <li>Time per session (15 min – 90 min)</li>
          <li>User completion rate and community rating</li>
        </ul>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">4.2 Starting a Workout</h3>
        <p className="text-foreground leading-relaxed mb-3">
          Tap <strong>Start Workout</strong> on any program. RAIMZEAL guides you through each exercise
          with animated demonstrations, rep counts, rest timers, and form cues. You can:
        </p>
        <ul className="list-disc list-inside space-y-1 text-foreground text-sm mb-4 ml-4">
          <li>Pause and resume at any time</li>
          <li>Substitute exercises with alternatives if you lack equipment</li>
          <li>Adjust weight/difficulty mid-session</li>
          <li>Log completion and add notes</li>
        </ul>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">4.3 Tracking Progress</h3>
        <p className="text-foreground leading-relaxed mb-3">
          All completed workouts are saved to your Fitness History. The progress chart shows workout
          frequency, volume (total weight lifted), cardio distance, and personal records. RAIMZEAL
          adapts your program's difficulty automatically as you progress.
        </p>
      </section>

      <section id="food" className="mb-12">
        <h2 className="text-2xl font-bold text-foreground mb-4 pb-2 border-b border-border">5. Food Therapy</h2>
        <p className="text-foreground leading-relaxed mb-4">
          Food Therapy is RAIMZEAL's nutrition module. It goes beyond calorie counting to treat food
          as medicine — connecting dietary choices to health outcomes, cultural traditions, and personal
          wellbeing.
        </p>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">5.1 AI Meal Planning</h3>
        <p className="text-foreground leading-relaxed mb-3">
          RAIMZEAL's AI generates personalized weekly meal plans based on your dietary preferences,
          health goals, cultural background, and nutritional targets. Each meal plan includes:
        </p>
        <ul className="list-disc list-inside space-y-1 text-foreground text-sm mb-4 ml-4">
          <li>Full recipes with ingredients and step-by-step instructions</li>
          <li>Complete nutritional breakdown (macros, key micronutrients)</li>
          <li>Estimated preparation time</li>
          <li>Substitution options for common allergens</li>
          <li>Cultural variant suggestions (e.g. West African, Caribbean, South Asian, Mediterranean)</li>
        </ul>
        <p className="text-foreground leading-relaxed mb-4">
          You can regenerate any meal you don't like, swap individual days, or request a new full plan
          at any time. Tap the refresh icon on any meal to get an alternative.
        </p>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">5.2 Food Logging</h3>
        <p className="text-foreground leading-relaxed mb-3">
          Log meals by searching RAIMZEAL's food database (500,000+ items), scanning a barcode, or
          taking a photo (AI image recognition identifies common foods automatically). Each log entry
          adds to your daily nutritional totals and health insights.
        </p>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">5.3 Food as Medicine</h3>
        <p className="text-foreground leading-relaxed mb-3">
          RAIMZEAL's Food as Medicine library connects specific foods to health conditions. If you have
          noted a health condition in your profile (e.g. high blood pressure, Type 2 diabetes,
          inflammatory conditions), RAIMZEAL highlights foods that scientific literature supports as
          beneficial — and flags foods to minimize. All recommendations are grounded in peer-reviewed
          research, with sources linked.
        </p>
      </section>

      <section id="mental" className="mb-12">
        <h2 className="text-2xl font-bold text-foreground mb-4 pb-2 border-b border-border">6. Mental Wellness</h2>
        <p className="text-foreground leading-relaxed mb-4">
          Mental wellness is a core pillar of RAIMZEAL — not an afterthought. The module includes mood
          tracking, AI-guided reflective check-ins, stress management tools, and connections to
          professional resources when needed.
        </p>

        <div className="space-y-4 mb-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="font-semibold text-foreground mb-2">Daily Mood Check-In</div>
            <div className="text-sm text-muted-foreground leading-relaxed">
              A 1-minute daily check-in captures your emotional state using a simple scale plus optional
              free-text notes. Over time, RAIMZEAL identifies patterns — what days, activities, foods,
              or sleep patterns correlate with better or worse moods — and surfaces them in your
              weekly summary.
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="font-semibold text-foreground mb-2">AI-Guided Reflections</div>
            <div className="text-sm text-muted-foreground leading-relaxed">
              When your mood log indicates stress, low energy, or difficulty, RAIMZEAL offers a brief
              AI-guided reflective exercise. These are evidence-based techniques drawn from CBT,
              mindfulness, and positive psychology. They typically take 5–10 minutes.
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="font-semibold text-foreground mb-2">Stress Management Library</div>
            <div className="text-sm text-muted-foreground leading-relaxed">
              Access breathing exercises, progressive muscle relaxation guides, grounding techniques,
              and sleep-preparation routines. All techniques are available offline after first load.
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="font-semibold text-foreground mb-2">Crisis Resources</div>
            <div className="text-sm text-muted-foreground leading-relaxed">
              RAIMZEAL is not a crisis service. If you indicate you are in crisis, the app immediately
              presents local emergency mental health resources and hotlines for your country. These
              are updated regularly. In the United States, the 988 Suicide & Crisis Lifeline is always
              linked.
            </div>
          </div>
        </div>

        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-sm text-foreground">
          <strong>Important:</strong> RAIMZEAL's mental wellness features are wellness tools, not medical
          treatment. They do not replace therapy, psychiatry, or other clinical care. If you are
          experiencing a mental health emergency, please contact emergency services or a crisis line.
        </div>
      </section>

      <section id="community" className="mb-12">
        <h2 className="text-2xl font-bold text-foreground mb-4 pb-2 border-b border-border">7. Community</h2>
        <p className="text-foreground leading-relaxed mb-4">
          RAIMZEAL's community is a space for shared motivation, accountability, and encouragement.
          Members post updates, ask questions, share achievements, and support each other across all
          six health pillars.
        </p>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">7.1 Creating Posts</h3>
        <p className="text-foreground leading-relaxed mb-3">
          Tap the <strong>+</strong> button on the Community tab to create a post. Posts can include
          text, photos, workout completions, meal logs, mood check-in results, or any combination.
          You can choose to share publicly (visible to all RAIMZEAL users) or only to your followers.
        </p>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">7.2 Likes and Comments</h3>
        <p className="text-foreground leading-relaxed mb-3">
          Engage with posts by liking (tap the heart) or commenting. Comments must follow the
          Community Guidelines. RAIMZEAL uses automated moderation to flag harmful content — users
          can also report any post or comment using the three-dot menu.
        </p>

        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">7.3 Community Guidelines</h3>
        <ul className="list-disc list-inside space-y-1 text-foreground text-sm mb-4 ml-4">
          <li>Be kind. This is a health community — vulnerability is welcome; cruelty is not.</li>
          <li>No medical advice. Share your experience; do not prescribe treatments to others.</li>
          <li>No spam, advertisements, or solicitation of any kind.</li>
          <li>No content that demeans body types, ethnicities, genders, or health conditions.</li>
          <li>Report content that violates these guidelines — moderators review all reports within 24 hours.</li>
        </ul>
        <p className="text-muted-foreground text-sm">
          Accounts that repeatedly violate community guidelines will be restricted or removed. RAIMZEAL
          reserves the right to remove any content that conflicts with its mission of inclusive,
          supportive health promotion.
        </p>
      </section>

      <section id="sleep" className="mb-12">
        <h2 className="text-2xl font-bold text-foreground mb-4 pb-2 border-b border-border">8. Sleep & Recovery</h2>
        <p className="text-foreground leading-relaxed mb-4">
          Sleep is one of the most powerful levers for health. RAIMZEAL's sleep module helps you
          understand, track, and improve your sleep quality using evidence-based techniques.
        </p>
        <ul className="list-disc list-inside space-y-2 text-foreground text-sm mb-4 ml-4">
          <li><strong>Sleep logging:</strong> Record your bedtime, wake time, and sleep quality each morning. Takes under 30 seconds.</li>
          <li><strong>Sleep score:</strong> RAIMZEAL calculates a daily sleep quality score based on duration, consistency, and self-reported quality.</li>
          <li><strong>Circadian guidance:</strong> Personalized recommendations for bedtime, morning light exposure, and evening wind-down routines based on your chronotype.</li>
          <li><strong>Recovery protocols:</strong> After intense workouts, RAIMZEAL recommends specific recovery techniques — sleep duration, hydration, nutrition, and active recovery — tailored to the session's intensity.</li>
          <li><strong>Sleep hygiene library:</strong> Evidence-based guides on sleep environment, screen use, caffeine timing, and relaxation techniques.</li>
        </ul>
      </section>

      <section id="preventive" className="mb-12">
        <h2 className="text-2xl font-bold text-foreground mb-4 pb-2 border-b border-border">9. Preventive Health</h2>
        <p className="text-foreground leading-relaxed mb-4">
          Preventive care is where RAIMZEAL's clinical roots show most clearly. This module is
          designed to catch risks before they become illness.
        </p>
        <div className="space-y-3 mb-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="font-semibold text-foreground mb-1">Health Risk Assessment</div>
            <div className="text-sm text-muted-foreground">
              A 10-minute questionnaire covering family history, lifestyle factors, and symptoms
              generates a personalized risk profile across major preventable conditions (cardiovascular
              disease, Type 2 diabetes, certain cancers, hypertension). Risk levels are educational,
              not diagnostic.
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="font-semibold text-foreground mb-1">Screening Reminders</div>
            <div className="text-sm text-muted-foreground">
              Based on your age, sex, and risk profile, RAIMZEAL reminds you when recommended health
              screenings are due (e.g. blood pressure checks, cholesterol panels, cancer screenings,
              dental visits, vision checks). These follow US Preventive Services Task Force (USPSTF)
              guidelines.
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="font-semibold text-foreground mb-1">Symptom Tracker</div>
            <div className="text-sm text-muted-foreground">
              Log recurring symptoms (headaches, fatigue, digestive issues, etc.). RAIMZEAL tracks
              patterns over time and suggests when a symptom pattern warrants a conversation with a
              healthcare provider. This tool is for awareness, not diagnosis.
            </div>
          </div>
        </div>
        <div className="bg-muted rounded-lg p-4 text-sm text-muted-foreground">
          <strong className="text-foreground">Disclaimer:</strong> RAIMZEAL's Preventive Health tools
          are educational and informational. They do not constitute medical advice, diagnosis, or
          treatment. Always consult a licensed healthcare provider for medical decisions.
        </div>
      </section>

      <section id="privacy" className="mb-12">
        <h2 className="text-2xl font-bold text-foreground mb-4 pb-2 border-b border-border">10. Privacy & Your Data</h2>
        <p className="text-foreground leading-relaxed mb-4">
          Your health data is yours. RAIMZEAL is built from the ground up to protect it.
        </p>
        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">What we collect</h3>
        <ul className="list-disc list-inside space-y-1 text-foreground text-sm mb-4 ml-4">
          <li>Account information (email or OAuth token, display name)</li>
          <li>Health profile data you enter (age, goals, dietary preferences)</li>
          <li>Activity logs you create (workouts, meals, mood check-ins, sleep logs)</li>
          <li>App usage data (screens visited, features used — anonymized)</li>
        </ul>
        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">What we never do</h3>
        <ul className="list-disc list-inside space-y-1 text-foreground text-sm mb-4 ml-4">
          <li>Sell your data to any third party — ever.</li>
          <li>Use your data for advertising purposes.</li>
          <li>Share individually identifiable health data with insurers, employers, or government bodies (except when legally required).</li>
          <li>Store payment information (RAIMZEAL is free — no payments are ever processed).</li>
        </ul>
        <h3 className="text-lg font-semibold text-foreground mb-3 mt-6">Your rights</h3>
        <ul className="list-disc list-inside space-y-1 text-foreground text-sm mb-4 ml-4">
          <li><strong>Export:</strong> Request a full export of all your data at any time from Settings → Privacy → Export My Data.</li>
          <li><strong>Delete:</strong> Permanently delete your account and all associated data from Settings → Privacy → Delete Account. Deletion is irreversible and completes within 30 days.</li>
          <li><strong>Correct:</strong> Update any incorrect information in your profile at any time.</li>
        </ul>
        <p className="text-muted-foreground text-sm">
          RAIMZEAL stores all health data in Supabase PostgreSQL with Row Level Security enabled —
          each user's data is cryptographically isolated. Data is encrypted at rest and in transit.
        </p>
      </section>

      <section id="troubleshooting" className="mb-12">
        <h2 className="text-2xl font-bold text-foreground mb-4 pb-2 border-b border-border">11. Troubleshooting & Support</h2>

        <div className="space-y-4 mb-6">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="font-semibold text-foreground mb-2">I can't sign in</div>
            <div className="text-sm text-muted-foreground leading-relaxed">
              Ensure you are using the same sign-in method you used to create your account. If you
              signed up with Apple, you must sign in with Apple — the same email via password login
              will not work. Use "Forgot Password" for email accounts, or try signing out of your Apple/Google
              account on your device and back in.
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="font-semibold text-foreground mb-2">My data didn't sync</div>
            <div className="text-sm text-muted-foreground leading-relaxed">
              Sync requires an internet connection. Pull down on the dashboard to force a manual sync.
              If data is still missing, sign out and sign back in — this triggers a full re-sync.
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="font-semibold text-foreground mb-2">A workout video won't load</div>
            <div className="text-sm text-muted-foreground leading-relaxed">
              Exercise demonstrations are loaded on demand and require a connection on first view.
              After first load they are cached locally. Try moving to a better network connection,
              or use the text-only mode toggle in the workout screen's settings.
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="font-semibold text-foreground mb-2">My meal plan doesn't match my preferences</div>
            <div className="text-sm text-muted-foreground leading-relaxed">
              Revisit your dietary preferences in Settings → My Profile → Dietary Preferences and
              verify all restrictions and preferences are set correctly. Then regenerate your meal plan
              from the Food Therapy tab (tap the three-dot menu → Regenerate Plan).
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="font-semibold text-foreground mb-2">I found a bug</div>
            <div className="text-sm text-muted-foreground leading-relaxed">
              Tap Settings → Help → Report a Bug. Include as much detail as possible. RAIMZEAL
              reviews all bug reports and prioritizes fixes in weekly releases.
            </div>
          </div>
        </div>

        <div className="bg-primary/10 border border-primary/30 rounded-lg p-5">
          <div className="font-semibold text-primary mb-2">Contact Support</div>
          <div className="text-sm text-foreground space-y-1">
            <div>Email: <span className="text-primary">support@raimzeal.com</span></div>
            <div>In-app: Settings → Help → Contact Support</div>
            <div className="text-muted-foreground mt-2">Response time: within 48 hours on business days.</div>
          </div>
        </div>
      </section>

      <div className="pt-8 border-t border-border text-xs text-muted-foreground text-center">
        RAIMZEAL User Guide · v1.3.0 · ECONTEUR LLC · June 2026 · raimzeal.com
      </div>
    </div>
  );
}
