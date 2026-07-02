/**
 * Full-screen branded loading screen shown while the app boots (session restore
 * and initial cloud sync). Replaces the bare spinner with the RAIMZEAL mark —
 * an animated heartbeat drawing through a barbell — plus the wordmark and mission
 * tagline, mirroring the mobile app's animated splash. Pure CSS/SVG, no deps.
 */
export function BrandedLoader({ label = 'Loading your journey…' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className="min-h-screen bg-background flex flex-col items-center justify-center gap-8 px-6"
    >
      <style>{`
        @keyframes rz-heartbeat-draw {
          0%   { stroke-dashoffset: 340; }
          55%  { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes rz-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%      { transform: scale(1.05); opacity: 0.92; }
        }
        @keyframes rz-ring {
          0%   { transform: scale(0.6); opacity: 0; }
          20%  { opacity: 0.5; }
          100% { transform: scale(1.25); opacity: 0; }
        }
        @keyframes rz-fade-up {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .rz-logo-wrap { position: relative; width: 132px; height: 132px; display: grid; place-items: center; }
        .rz-ring {
          position: absolute; inset: 0; border-radius: 28px;
          border: 2px solid hsl(var(--primary));
          animation: rz-ring 2.1s ease-out infinite;
        }
        .rz-ring.delay { animation-delay: 1.05s; }
        .rz-logo { animation: rz-pulse 2.1s ease-in-out infinite; }
        .rz-heartbeat {
          stroke-dasharray: 340;
          animation: rz-heartbeat-draw 2.1s ease-in-out infinite;
        }
        .rz-text { animation: rz-fade-up 0.6s ease-out both; animation-delay: 0.25s; }
        @media (prefers-reduced-motion: reduce) {
          .rz-logo, .rz-ring, .rz-heartbeat, .rz-text { animation: none !important; }
          .rz-heartbeat { stroke-dashoffset: 0; }
          .rz-ring { display: none; }
        }
      `}</style>

      <div className="rz-logo-wrap">
        <span className="rz-ring" aria-hidden="true" />
        <span className="rz-ring delay" aria-hidden="true" />
        <svg
          className="rz-logo"
          width="120"
          height="120"
          viewBox="0 0 180 180"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <rect width="180" height="180" rx="36" fill="#0a0a0b" />
          <rect x="34" y="86" width="112" height="8" rx="4" fill="hsl(var(--primary))" />
          <rect x="30" y="66" width="10" height="48" rx="3" fill="hsl(var(--primary))" />
          <rect x="18" y="72" width="14" height="36" rx="3" fill="hsl(var(--primary))" />
          <rect x="140" y="66" width="10" height="48" rx="3" fill="hsl(var(--primary))" />
          <rect x="148" y="72" width="14" height="36" rx="3" fill="hsl(var(--primary))" />
          <polyline
            className="rz-heartbeat"
            points="42,90 62,90 70,66 80,116 90,54 100,120 110,78 120,90 138,90"
            fill="none"
            stroke="#ffffff"
            strokeWidth="5.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <div className="rz-text flex flex-col items-center gap-2">
        <div
          className="text-2xl font-bold tracking-[0.35em] text-foreground"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          RAIMZEAL
        </div>
        <div className="text-xs tracking-wide text-muted-foreground text-center">
          Fitness · Food Therapy · Health Awareness
        </div>
        <div className="sr-only">{label}</div>
      </div>
    </div>
  );
}
