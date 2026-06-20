import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';

export const DEV_SCENE_DURATIONS = {
  d1_hook: 7000,
  d2_arch: 10000,
  d3_api: 10000,
  d4_database: 10000,
  d5_mobile: 10000,
  d6_contributing: 8000,
  d7_cta: 8000,
};

const GOLD = '#C8A84B';
const GREEN = '#2D8C4E';
const WHITE = '#F0EDE8';
const MUTED = '#888888';
const SURFACE = '#1A1A1A';
const BORDER = '#2A2A2A';

function CodeBlock({ lines, active, delay = 0 }: { lines: string[]; active: boolean; delay?: number }) {
  return (
    <motion.div style={{ background: '#0a0a0a', border: `1px solid ${BORDER}`, borderRadius: '1vw', padding: '2vh 2vw', fontFamily: 'monospace' }}
      initial={{ opacity: 0, y: 10 }} animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
      transition={{ duration: 0.5, delay }}>
      {lines.map((line, i) => (
        <div key={i} style={{ fontSize: '1.2vw', lineHeight: '1.8em', color: line.startsWith('//') ? '#555' : line.includes(':') ? '#C8A84B' : '#F0EDE8' }}>
          {line}
        </div>
      ))}
    </motion.div>
  );
}

function ArchBox({ label, sub, color, active, delay }: { label: string; sub: string; color: string; active: boolean; delay: number }) {
  return (
    <motion.div style={{ background: SURFACE, border: `1px solid ${color}40`, borderLeft: `3px solid ${color}`, borderRadius: '0.8vw', padding: '1.5vh 1.5vw' }}
      initial={{ opacity: 0, x: -15 }} animate={active ? { opacity: 1, x: 0 } : { opacity: 0, x: -15 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay }}>
      <div style={{ color, fontWeight: 700, fontSize: '1.4vw' }}>{label}</div>
      <div style={{ color: MUTED, fontSize: '1.1vw', marginTop: '0.3vh' }}>{sub}</div>
    </motion.div>
  );
}

// ─── D1: Hook ─────────────────────────────────────────────────────────────────
function D1_Hook() {
  const [ph, setPh] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPh(1), 300), setTimeout(() => setPh(2), 2500), setTimeout(() => setPh(3), 4800)];
    return () => t.forEach(clearTimeout);
  }, []);
  return (
    <motion.div className="absolute inset-0 z-20 flex flex-col items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(12px)', scale: 1.02 }} transition={{ duration: 0.5 }}>
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(200,168,75,0.04) 39px, rgba(200,168,75,0.04) 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(200,168,75,0.04) 39px, rgba(200,168,75,0.04) 40px)' }} />
      <div className="text-center px-[7vw] w-full">
        <motion.div style={{ fontSize: '1.4vw', color: GREEN, fontWeight: 700, letterSpacing: '0.25em', marginBottom: '2vh', fontFamily: 'monospace' }}
          initial={{ opacity: 0 }} animate={ph >= 1 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.6 }}>
          OPEN · SOURCE · HEALTH · INFRASTRUCTURE
        </motion.div>
        <motion.div style={{ fontSize: '7.5vw', color: WHITE, fontWeight: 900, lineHeight: 1, marginBottom: '1.5vh' }}
          initial={{ opacity: 0, y: 20 }} animate={ph >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}>
          BUILD THE
        </motion.div>
        <motion.div style={{ fontSize: '7.5vw', color: GOLD, fontWeight: 900, lineHeight: 1, marginBottom: '4vh' }}
          initial={{ opacity: 0, y: 20 }} animate={ph >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}>
          FUTURE.
        </motion.div>
        <motion.div style={{ fontSize: '1.6vw', color: MUTED, fontFamily: 'monospace' }}
          initial={{ opacity: 0 }} animate={ph >= 2 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.6 }}>
          TypeScript · pnpm monorepo · Express 5 · Expo SDK 54 · Supabase · Drizzle ORM
        </motion.div>
        <motion.div style={{ display: 'inline-flex', background: GREEN + '20', border: `1px solid ${GREEN}`, borderRadius: 999, padding: '0.8vh 2vw', marginTop: '3.5vh', fontSize: '1.3vw', color: GREEN, fontWeight: 700 }}
          initial={{ opacity: 0, scale: 0.9 }} animate={ph >= 3 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}>
          $51/month · 50,000 users · Zero compromise
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── D2: Architecture ─────────────────────────────────────────────────────────
function D2_Arch() {
  const [ph, setPh] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPh(1), 300), setTimeout(() => setPh(2), 1800)];
    return () => t.forEach(clearTimeout);
  }, []);
  const boxes = [
    { label: 'artifacts/api-server', sub: 'Express 5 · Drizzle ORM · Pino logging', color: GOLD },
    { label: 'artifacts/raimzeal', sub: 'React · Vite · TailwindCSS · React Query', color: GREEN },
    { label: 'artifacts/raimzeal-mobile', sub: 'Expo SDK 54 · expo-router v4 · NativeWind', color: '#60a5fa' },
    { label: 'lib/db', sub: 'Drizzle schema · Supabase client · RLS', color: GOLD },
    { label: 'lib/api-spec', sub: 'OpenAPI 3.1 · Orval codegen · Zod + React Query', color: GREEN },
  ];
  return (
    <motion.div className="absolute inset-0 z-20 flex flex-col justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(12px)', scale: 1.02 }} transition={{ duration: 0.5 }}>
      <div style={{ padding: '4vh 5vw' }}>
        <motion.div style={{ fontSize: '1.4vw', color: GOLD, fontWeight: 700, letterSpacing: '0.2em', marginBottom: '1vh' }}
          initial={{ opacity: 0 }} animate={ph >= 1 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.5 }}>
          MONOREPO ARCHITECTURE
        </motion.div>
        <motion.div style={{ fontSize: '4vw', color: WHITE, fontWeight: 800, marginBottom: '4vh' }}
          initial={{ opacity: 0, y: 10 }} animate={ph >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.6, delay: 0.1 }}>
          @workspace / pnpm
        </motion.div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5vh' }}>
          {boxes.map((b, i) => (
            <ArchBox key={b.label} {...b} active={ph >= 2} delay={0.1 * i} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── D3: Contract-First API ───────────────────────────────────────────────────
function D3_API() {
  const [ph, setPh] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPh(1), 300), setTimeout(() => setPh(2), 2500), setTimeout(() => setPh(3), 5500)];
    return () => t.forEach(clearTimeout);
  }, []);
  const steps = [
    { label: 'openapi.yaml', desc: 'Source of truth for all API contracts', color: GOLD },
    { label: 'pnpm codegen', desc: 'One command. Zero drift.', color: MUTED },
    { label: 'React Query hooks', desc: 'Generated → used by web & mobile', color: GREEN },
    { label: 'Zod schemas', desc: 'Generated → used by API server for validation', color: GREEN },
  ];
  return (
    <motion.div className="absolute inset-0 z-20 flex flex-col justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(12px)', scale: 1.02 }} transition={{ duration: 0.5 }}>
      <div style={{ padding: '4vh 5vw' }}>
        <motion.div style={{ fontSize: '1.4vw', color: GOLD, fontWeight: 700, letterSpacing: '0.2em', marginBottom: '1vh' }}
          initial={{ opacity: 0 }} animate={ph >= 1 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.5 }}>
          CONTRACT-FIRST DEVELOPMENT
        </motion.div>
        <motion.div style={{ fontSize: '4vw', color: WHITE, fontWeight: 800, marginBottom: '5vh' }}
          initial={{ opacity: 0, y: 10 }} animate={ph >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.6, delay: 0.1 }}>
          ONE SPEC. TWO CLIENTS. ZERO DRIFT.
        </motion.div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2vw', flexWrap: 'wrap' }}>
          {steps.map((s, i) => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '2vw' }}>
              <motion.div style={{ background: SURFACE, border: `1px solid ${s.color}50`, borderRadius: '1vw', padding: '2vh 2vw', textAlign: 'center', minWidth: '16vw' }}
                initial={{ opacity: 0, y: 15 }} animate={ph >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
                transition={{ duration: 0.5, delay: 0.12 * i }}>
                <div style={{ color: s.color, fontWeight: 800, fontSize: '1.5vw', fontFamily: 'monospace' }}>{s.label}</div>
                <div style={{ color: MUTED, fontSize: '1.1vw', marginTop: '0.5vh' }}>{s.desc}</div>
              </motion.div>
              {i < steps.length - 1 && (
                <motion.div style={{ color: MUTED, fontSize: '2vw', fontWeight: 300 }}
                  initial={{ opacity: 0 }} animate={ph >= 2 ? { opacity: 1 } : { opacity: 0 }}
                  transition={{ duration: 0.3, delay: 0.12 * i + 0.1 }}>→</motion.div>
              )}
            </div>
          ))}
        </div>
        <CodeBlock lines={['// Update spec → run codegen → done', 'pnpm --filter @workspace/api-spec run codegen']} active={ph >= 3} delay={0} />
      </div>
    </motion.div>
  );
}

// ─── D4: Database ─────────────────────────────────────────────────────────────
function D4_Database() {
  const [ph, setPh] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPh(1), 300), setTimeout(() => setPh(2), 2000), setTimeout(() => setPh(3), 5000)];
    return () => t.forEach(clearTimeout);
  }, []);
  const tables = ['users', 'user_profiles', 'health_logs', 'meal_plans', 'fitness_programs', 'community_posts'];
  return (
    <motion.div className="absolute inset-0 z-20 flex flex-col justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(12px)', scale: 1.02 }} transition={{ duration: 0.5 }}>
      <div style={{ padding: '4vh 5vw' }}>
        <motion.div style={{ fontSize: '1.4vw', color: GOLD, fontWeight: 700, letterSpacing: '0.2em', marginBottom: '1vh' }}
          initial={{ opacity: 0 }} animate={ph >= 1 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.5 }}>
          DATABASE LAYER
        </motion.div>
        <motion.div style={{ fontSize: '3.8vw', color: WHITE, fontWeight: 800, marginBottom: '4vh' }}
          initial={{ opacity: 0, y: 10 }} animate={ph >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.6, delay: 0.1 }}>
          SUPABASE PostgreSQL · DRIZZLE ORM
        </motion.div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.2vw', marginBottom: '4vh' }}>
          {tables.map((t, i) => (
            <motion.div key={t} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '0.6vw', padding: '0.8vh 1.5vw', fontFamily: 'monospace', color: GREEN, fontSize: '1.3vw' }}
              initial={{ opacity: 0, scale: 0.9 }} animate={ph >= 2 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22, delay: 0.07 * i }}>
              {t}
            </motion.div>
          ))}
        </div>
        <motion.div style={{ display: 'flex', gap: '2vw' }}
          initial={{ opacity: 0 }} animate={ph >= 3 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.6 }}>
          {['Row Level Security on every table', 'Service role key: server only', 'Drizzle migrations: version-controlled'].map((item, i) => (
            <div key={i} style={{ flex: 1, background: '#0a0a0a', border: `1px solid ${GREEN}30`, borderRadius: '0.8vw', padding: '1.5vh 1.5vw' }}>
              <div style={{ color: GREEN, fontSize: '1.3vw', fontWeight: 600 }}>✓ {item}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── D5: Mobile ───────────────────────────────────────────────────────────────
function D5_Mobile() {
  const [ph, setPh] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPh(1), 300), setTimeout(() => setPh(2), 2200), setTimeout(() => setPh(3), 5500)];
    return () => t.forEach(clearTimeout);
  }, []);
  const deps = [
    { name: 'expo-router v4', desc: 'File-based navigation' },
    { name: 'expo-apple-authentication', desc: 'Required for iOS App Store' },
    { name: 'expo-auth-session', desc: 'Google OAuth on mobile (NOT @react-native-google-signin)' },
    { name: '@tanstack/react-query', desc: 'Data fetching + caching' },
    { name: 'nativewind', desc: 'Tailwind CSS for React Native' },
  ];
  return (
    <motion.div className="absolute inset-0 z-20 flex flex-col justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(12px)', scale: 1.02 }} transition={{ duration: 0.5 }}>
      <div style={{ padding: '4vh 5vw' }}>
        <motion.div style={{ fontSize: '1.4vw', color: GOLD, fontWeight: 700, letterSpacing: '0.2em', marginBottom: '1vh' }}
          initial={{ opacity: 0 }} animate={ph >= 1 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.5 }}>
          MOBILE · iOS + ANDROID
        </motion.div>
        <motion.div style={{ fontSize: '3.5vw', color: WHITE, fontWeight: 800, marginBottom: '4vh' }}
          initial={{ opacity: 0, y: 10 }} animate={ph >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.6, delay: 0.1 }}>
          EXPO SDK 54 · EAS BUILD
        </motion.div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5vh', marginBottom: '3vh' }}>
          {deps.map((d, i) => (
            <motion.div key={d.name} style={{ display: 'flex', gap: '2vw', alignItems: 'center', background: SURFACE, borderRadius: '0.8vw', padding: '1.2vh 2vw', border: `1px solid ${BORDER}` }}
              initial={{ opacity: 0, x: -15 }} animate={ph >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -15 }}
              transition={{ duration: 0.4, delay: 0.1 * i }}>
              <span style={{ color: GOLD, fontFamily: 'monospace', fontSize: '1.2vw', fontWeight: 700, minWidth: '20vw' }}>{d.name}</span>
              <span style={{ color: MUTED, fontSize: '1.1vw' }}>{d.desc}</span>
            </motion.div>
          ))}
        </div>
        <CodeBlock lines={['eas build --profile production --platform ios', 'eas submit --platform ios --latest']} active={ph >= 3} delay={0} />
      </div>
    </motion.div>
  );
}

// ─── D6: Contributing ─────────────────────────────────────────────────────────
function D6_Contributing() {
  const [ph, setPh] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPh(1), 400), setTimeout(() => setPh(2), 2000), setTimeout(() => setPh(3), 5000)];
    return () => t.forEach(clearTimeout);
  }, []);
  const rules = [
    { rule: 'SPEC FIRST', detail: 'Update openapi.yaml → codegen → code', color: GOLD },
    { rule: 'STRICT TYPES', detail: 'Zero TypeScript errors. No any. No exceptions.', color: GREEN },
    { rule: 'NO console.log', detail: 'Use req.log (routes) or singleton logger (everywhere else)', color: GOLD },
    { rule: 'CODEGEN IS CANON', detail: 'Never hand-write what the spec generates', color: GREEN },
  ];
  return (
    <motion.div className="absolute inset-0 z-20 flex flex-col justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(12px)', scale: 1.02 }} transition={{ duration: 0.5 }}>
      <div style={{ padding: '4vh 5vw' }}>
        <motion.div style={{ fontSize: '1.4vw', color: GOLD, fontWeight: 700, letterSpacing: '0.2em', marginBottom: '1vh' }}
          initial={{ opacity: 0 }} animate={ph >= 1 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.5 }}>
          CONTRIBUTING STANDARDS
        </motion.div>
        <motion.div style={{ fontSize: '4vw', color: WHITE, fontWeight: 800, marginBottom: '4vh' }}
          initial={{ opacity: 0, y: 10 }} animate={ph >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.6, delay: 0.1 }}>
          THREE NON-NEGOTIABLES
        </motion.div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2vh' }}>
          {rules.map((r, i) => (
            <motion.div key={r.rule} style={{ display: 'flex', gap: '2.5vw', alignItems: 'center' }}
              initial={{ opacity: 0, x: -20 }} animate={ph >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
              transition={{ duration: 0.5, delay: 0.1 * i }}>
              <div style={{ color: r.color, fontWeight: 900, fontSize: '1.5vw', fontFamily: 'monospace', minWidth: '14vw' }}>/ {r.rule}</div>
              <div style={{ color: MUTED, fontSize: '1.4vw' }}>{r.detail}</div>
            </motion.div>
          ))}
        </div>
        <motion.div style={{ marginTop: '4vh', background: '#0a0a0a', border: `1px solid ${BORDER}`, borderRadius: '1vw', padding: '1.5vh 2vw', fontFamily: 'monospace', fontSize: '1.2vw', color: GREEN }}
          initial={{ opacity: 0 }} animate={ph >= 3 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.5 }}>
          pnpm run typecheck  # Must pass with zero errors before every commit
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── D7: CTA ──────────────────────────────────────────────────────────────────
function D7_CTA() {
  const [ph, setPh] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPh(1), 400), setTimeout(() => setPh(2), 2800), setTimeout(() => setPh(3), 5200)];
    return () => t.forEach(clearTimeout);
  }, []);
  return (
    <motion.div className="absolute inset-0 z-20 flex flex-col items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05, filter: 'blur(12px)' }} transition={{ duration: 0.5 }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(200,168,75,0.12) 0%, transparent 60%)' }} />
      <div className="text-center px-[8vw] w-full">
        <motion.div style={{ fontSize: '2vw', color: MUTED, fontFamily: 'monospace', marginBottom: '3vh', letterSpacing: '0.1em' }}
          initial={{ opacity: 0 }} animate={ph >= 1 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.5 }}>
          // your contribution heals the world
        </motion.div>
        <motion.div style={{ fontSize: '7vw', color: WHITE, fontWeight: 900, lineHeight: 1 }}
          initial={{ opacity: 0, y: 20 }} animate={ph >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}>
          CONTRIBUTE.
        </motion.div>
        <motion.div style={{ fontSize: '7vw', color: GOLD, fontWeight: 900, lineHeight: 1 }}
          initial={{ opacity: 0, y: 20 }} animate={ph >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}>
          BUILD.
        </motion.div>
        <motion.div style={{ fontSize: '7vw', color: GREEN, fontWeight: 900, lineHeight: 1, marginBottom: '5vh' }}
          initial={{ opacity: 0, y: 20 }} animate={ph >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}>
          HEAL.
        </motion.div>
        <motion.div style={{ fontSize: '2.5vw', color: GOLD, fontWeight: 700 }}
          initial={{ opacity: 0, y: 10 }} animate={ph >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.6 }}>
          raimzeal.com
        </motion.div>
        <motion.div style={{ fontSize: '1.4vw', color: MUTED, marginTop: '1.5vh', fontFamily: 'monospace' }}
          initial={{ opacity: 0 }} animate={ph >= 3 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.5 }}>
          Free · Open · Evidence-Based · ECONTEUR LLC
        </motion.div>
      </div>
    </motion.div>
  );
}

const DEV_SCENES: Record<string, React.ComponentType> = {
  d1_hook: D1_Hook, d2_arch: D2_Arch, d3_api: D3_API,
  d4_database: D4_Database, d5_mobile: D5_Mobile,
  d6_contributing: D6_Contributing, d7_cta: D7_CTA,
};

export default function VideoDev({
  durations = DEV_SCENE_DURATIONS,
  loop = true,
  muted = false,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  muted?: boolean;
  onSceneChange?: (key: string) => void;
} = {}) {
  const { currentSceneKey } = useVideoPlayer({ durations, loop });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => { onSceneChange?.(currentSceneKey); }, [currentSceneKey, onSceneChange]);
  const baseKey = currentSceneKey.replace(/_r[12]$/, '');
  const sceneIndex = Object.keys(DEV_SCENE_DURATIONS).indexOf(baseKey);
  const SceneComponent = DEV_SCENES[baseKey] ?? D1_Hook;
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.3;
    audio.play().catch(() => {});
  }, [muted]);
  const bgTints = ['rgba(200,168,75,0.06)', 'rgba(45,140,78,0.06)', 'rgba(200,168,75,0.07)', 'rgba(45,140,78,0.07)', 'rgba(96,165,250,0.05)', 'rgba(200,168,75,0.06)', 'rgba(200,168,75,0.10)'];
  const accentTops = ['12%', '30%', '50%', '70%', '85%', '40%', '20%'];
  return (
    <>
      <div className="relative w-full h-screen overflow-hidden bg-[#080C10]">
        <div className="absolute inset-0 z-0 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 49px, rgba(200,168,75,0.03) 49px, rgba(200,168,75,0.03) 50px), repeating-linear-gradient(90deg, transparent, transparent 49px, rgba(200,168,75,0.03) 49px, rgba(200,168,75,0.03) 50px)' }} />
        <motion.div className="absolute inset-0 z-0 pointer-events-none"
          animate={{ backgroundColor: bgTints[sceneIndex] ?? bgTints[0] }} transition={{ duration: 1.5, ease: 'easeInOut' }} />
        <motion.div className="absolute left-0 right-0 h-[2px] z-10 pointer-events-none"
          style={{ background: GOLD, boxShadow: `0 0 16px rgba(200,168,75,0.5)` }}
          animate={{ top: accentTops[sceneIndex] ?? '50%' }} transition={{ duration: 2, ease: [0.22, 1, 0.36, 1] }} />
        <AnimatePresence mode="popLayout">
          {SceneComponent && <SceneComponent key={currentSceneKey} />}
        </AnimatePresence>
      </div>
      <audio ref={audioRef} src={`${import.meta.env.BASE_URL}audio/bg_music.mp3`} preload="auto" loop muted={muted} />
    </>
  );
}
