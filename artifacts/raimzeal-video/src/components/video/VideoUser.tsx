import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';

export const USER_SCENE_DURATIONS = {
  u1_hook: 8000,
  u2_pillars: 10000,
  u3_onboard: 8000,
  u4_fitness_food: 10000,
  u5_mental_sleep: 10000,
  u6_community: 8000,
  u7_privacy: 8000,
  u8_cta: 8000,
};

// ─── Shared helpers ───────────────────────────────────────────────────────────
const GOLD = '#C8A84B';
const GREEN = '#2D8C4E';
const WHITE = '#F0EDE8';
const MUTED = '#888888';

function CharReveal({ text, phase, active, size, color, delay = 0 }: { text: string; phase: number; active: boolean; size: string; color: string; delay?: number }) {
  return (
    <span style={{ display: 'block' }}>
      {text.split('').map((c, i) => (
        <motion.span key={i} style={{ display: 'inline-block', fontSize: size, color, fontWeight: 800, lineHeight: 1 }}
          initial={{ opacity: 0, y: '40%', rotateX: 80 }}
          animate={active ? { opacity: 1, y: 0, rotateX: 0 } : { opacity: 0, y: '40%', rotateX: 80 }}
          transition={{ type: 'spring', stiffness: 380, damping: 24, delay: delay + i * 0.055 }}>
          {c === ' ' ? '\u00a0' : c}
        </motion.span>
      ))}
    </span>
  );
}

function Pill({ label, icon, delay, active }: { label: string; icon: string; delay: number; active: boolean }) {
  return (
    <motion.div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 999, padding: '0.8vh 2.2vw', display: 'flex', alignItems: 'center', gap: '0.8vw' }}
      initial={{ opacity: 0, x: -20 }}
      animate={active ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay }}>
      <span style={{ fontSize: '1.6vw' }}>{icon}</span>
      <span style={{ color: WHITE, fontSize: '1.3vw', fontWeight: 600 }}>{label}</span>
    </motion.div>
  );
}

// ─── U1: Hook ─────────────────────────────────────────────────────────────────
function U1_Hook() {
  const [ph, setPh] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPh(1), 300), setTimeout(() => setPh(2), 2200), setTimeout(() => setPh(3), 5500)];
    return () => t.forEach(clearTimeout);
  }, []);
  return (
    <motion.div className="absolute inset-0 z-20 flex flex-col items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(12px)', scale: 1.02 }} transition={{ duration: 0.5 }}>
      <div className="absolute top-[-5vh] right-[-5vw] w-[50vw] h-[50vw] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(200,168,75,0.12) 0%, transparent 65%)', filter: 'blur(50px)' }} />
      <div className="text-center px-[6vw] w-full">
        <CharReveal text="HEALTHCARE" phase={ph} active={ph >= 1} size="10vw" color={GOLD} />
        <motion.div style={{ fontSize: '4.8vw', color: WHITE, fontWeight: 700, marginTop: '1.5vh', lineHeight: 1.1 }}
          initial={{ opacity: 0, x: '-4vw' }} animate={ph >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: '-4vw' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
          SHOULDN'T COST ANYTHING.
        </motion.div>
        <motion.div className="mx-auto h-[3px]" style={{ background: GOLD, marginTop: '3vh' }}
          initial={{ width: 0 }} animate={ph >= 2 ? { width: '28vw' } : { width: 0 }}
          transition={{ duration: 0.9, ease: 'circOut', delay: 0.2 }} />
        <motion.div style={{ fontSize: '1.8vw', color: MUTED, marginTop: '3.5vh' }}
          initial={{ opacity: 0 }} animate={ph >= 3 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.8 }}>
          RAIMZEAL is free. For every human. Always.
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── U2: Six Pillars ──────────────────────────────────────────────────────────
function U2_Pillars() {
  const [ph, setPh] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPh(1), 400), setTimeout(() => setPh(2), 2000)];
    return () => t.forEach(clearTimeout);
  }, []);
  const pillars = [
    { icon: '💪', label: 'Fitness' }, { icon: '🥗', label: 'Food Therapy' }, { icon: '🧠', label: 'Mental Wellness' },
    { icon: '👥', label: 'Community' }, { icon: '😴', label: 'Sleep & Recovery' }, { icon: '🛡️', label: 'Preventive Health' },
  ];
  return (
    <motion.div className="absolute inset-0 z-20 flex flex-col items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(12px)', scale: 1.02 }} transition={{ duration: 0.5 }}>
      <div className="absolute bottom-0 left-0 w-[35vw] h-[35vw] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(45,140,78,0.12) 0%, transparent 65%)', filter: 'blur(50px)' }} />
      <div className="w-full px-[8vw]">
        <motion.div style={{ fontSize: '1.5vw', color: GOLD, fontWeight: 700, letterSpacing: '0.2em', marginBottom: '2vh' }}
          initial={{ opacity: 0 }} animate={ph >= 1 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.6 }}>
          ONE FREE PLATFORM
        </motion.div>
        <motion.div style={{ fontSize: '5vw', color: WHITE, fontWeight: 800, marginBottom: '5vh', lineHeight: 1 }}
          initial={{ opacity: 0, y: 20 }} animate={ph >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.1 }}>
          SIX DISCIPLINES
        </motion.div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5vh' }}>
          {pillars.map((p, i) => (
            <Pill key={p.label} {...p} active={ph >= 2} delay={0.08 * i} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── U3: Getting Started ──────────────────────────────────────────────────────
function U3_Onboard() {
  const [ph, setPh] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPh(1), 400), setTimeout(() => setPh(2), 2200), setTimeout(() => setPh(3), 4500)];
    return () => t.forEach(clearTimeout);
  }, []);
  const steps = ['Download RAIMZEAL', 'Complete your health profile', 'Your dashboard is ready'];
  return (
    <motion.div className="absolute inset-0 z-20 flex flex-col items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(12px)', scale: 1.02 }} transition={{ duration: 0.5 }}>
      <div className="absolute top-[10vh] right-[5vw] w-[30vw] h-[30vw] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(200,168,75,0.10) 0%, transparent 65%)', filter: 'blur(40px)' }} />
      <div className="text-center px-[8vw] w-full">
        <CharReveal text="3 MINUTES" phase={ph} active={ph >= 1} size="9vw" color={GOLD} />
        <motion.div style={{ fontSize: '4vw', color: WHITE, fontWeight: 700, marginTop: '1vh' }}
          initial={{ opacity: 0 }} animate={ph >= 1 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.6, delay: 0.3 }}>
          TO BETTER HEALTH
        </motion.div>
        <div style={{ marginTop: '5vh', display: 'flex', flexDirection: 'column', gap: '2.5vh', alignItems: 'center' }}>
          {steps.map((s, i) => (
            <motion.div key={i} style={{ display: 'flex', alignItems: 'center', gap: '2vw' }}
              initial={{ opacity: 0, x: -20 }} animate={ph >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.1 * i }}>
              <div style={{ width: '3.5vw', height: '3.5vw', borderRadius: '50%', background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: WHITE, fontWeight: 800, fontSize: '1.5vw' }}>{i + 1}</span>
              </div>
              <span style={{ color: ph >= 3 ? WHITE : MUTED, fontSize: '2vw', fontWeight: 600, transition: 'color 0.4s' }}>{s}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── U4: Fitness + Food ───────────────────────────────────────────────────────
function U4_FitnessFood() {
  const [ph, setPh] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPh(1), 300), setTimeout(() => setPh(2), 2500), setTimeout(() => setPh(3), 4500), setTimeout(() => setPh(4), 7000)];
    return () => t.forEach(clearTimeout);
  }, []);
  const leftItems = ['Personalized programs by goal', 'Guided workouts with form cues', 'No gym required — ever'];
  const rightItems = ['AI-generated weekly meal plans', 'Culturally adaptive recipes', 'Barcode & photo food logging'];
  return (
    <motion.div className="absolute inset-0 z-20 flex flex-col items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(12px)', scale: 1.02 }} transition={{ duration: 0.5 }}>
      <div style={{ display: 'flex', width: '100%', height: '100%', padding: '6vh 5vw', gap: '2vw' }}>
        {/* Left: Fitness */}
        <motion.div style={{ flex: 1, background: '#111', border: '1px solid #2A2A2A', borderRadius: '2vw', padding: '4vh 3vw', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
          initial={{ opacity: 0, x: '-5vw' }} animate={ph >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: '-5vw' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
          <div style={{ fontSize: '2.5vw', color: GOLD, fontWeight: 800, marginBottom: '1vh' }}>💪 PERSONALIZED</div>
          <div style={{ fontSize: '2.5vw', color: WHITE, fontWeight: 800, marginBottom: '3vh' }}>FITNESS</div>
          {leftItems.map((item, i) => (
            <motion.div key={i} style={{ display: 'flex', gap: '1vw', alignItems: 'flex-start', marginBottom: '1.8vh' }}
              initial={{ opacity: 0, x: -10 }} animate={ph >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
              transition={{ duration: 0.4, delay: 0.12 * i }}>
              <span style={{ color: GREEN, fontSize: '1.5vw', flexShrink: 0, marginTop: '0.1em' }}>▸</span>
              <span style={{ color: MUTED, fontSize: '1.5vw', lineHeight: 1.4 }}>{item}</span>
            </motion.div>
          ))}
        </motion.div>
        {/* Right: Food */}
        <motion.div style={{ flex: 1, background: '#111', border: '1px solid #2A2A2A', borderRadius: '2vw', padding: '4vh 3vw', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
          initial={{ opacity: 0, x: '5vw' }} animate={ph >= 3 ? { opacity: 1, x: 0 } : { opacity: 0, x: '5vw' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
          <div style={{ fontSize: '2.5vw', color: GOLD, fontWeight: 800, marginBottom: '1vh' }}>🥗 AI MEAL</div>
          <div style={{ fontSize: '2.5vw', color: WHITE, fontWeight: 800, marginBottom: '3vh' }}>PLANNING</div>
          {rightItems.map((item, i) => (
            <motion.div key={i} style={{ display: 'flex', gap: '1vw', alignItems: 'flex-start', marginBottom: '1.8vh' }}
              initial={{ opacity: 0, x: -10 }} animate={ph >= 4 ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
              transition={{ duration: 0.4, delay: 0.12 * i }}>
              <span style={{ color: GREEN, fontSize: '1.5vw', flexShrink: 0, marginTop: '0.1em' }}>▸</span>
              <span style={{ color: MUTED, fontSize: '1.5vw', lineHeight: 1.4 }}>{item}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── U5: Mental + Sleep ───────────────────────────────────────────────────────
function U5_MentalSleep() {
  const [ph, setPh] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPh(1), 300), setTimeout(() => setPh(2), 2500), setTimeout(() => setPh(3), 4500), setTimeout(() => setPh(4), 7000)];
    return () => t.forEach(clearTimeout);
  }, []);
  const leftItems = ['Daily mood check-in (1 minute)', 'AI-guided CBT & mindfulness', 'Stress & breathing library'];
  const rightItems = ['Daily sleep quality score', 'Circadian guidance & routines', 'Recovery protocols after workouts'];
  return (
    <motion.div className="absolute inset-0 z-20 flex flex-col items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(12px)', scale: 1.02 }} transition={{ duration: 0.5 }}>
      <div style={{ display: 'flex', width: '100%', height: '100%', padding: '6vh 5vw', gap: '2vw' }}>
        <motion.div style={{ flex: 1, background: '#0f0f1a', border: '1px solid #2A2A2A', borderRadius: '2vw', padding: '4vh 3vw', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
          initial={{ opacity: 0, x: '-5vw' }} animate={ph >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: '-5vw' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
          <div style={{ fontSize: '2.5vw', color: GOLD, fontWeight: 800, marginBottom: '1vh' }}>🧠 MENTAL</div>
          <div style={{ fontSize: '2.5vw', color: WHITE, fontWeight: 800, marginBottom: '3vh' }}>WELLNESS</div>
          {leftItems.map((item, i) => (
            <motion.div key={i} style={{ display: 'flex', gap: '1vw', alignItems: 'flex-start', marginBottom: '1.8vh' }}
              initial={{ opacity: 0, x: -10 }} animate={ph >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
              transition={{ duration: 0.4, delay: 0.12 * i }}>
              <span style={{ color: GOLD, fontSize: '1.5vw', flexShrink: 0 }}>▸</span>
              <span style={{ color: MUTED, fontSize: '1.5vw', lineHeight: 1.4 }}>{item}</span>
            </motion.div>
          ))}
        </motion.div>
        <motion.div style={{ flex: 1, background: '#0a0f0a', border: '1px solid #2A2A2A', borderRadius: '2vw', padding: '4vh 3vw', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
          initial={{ opacity: 0, x: '5vw' }} animate={ph >= 3 ? { opacity: 1, x: 0 } : { opacity: 0, x: '5vw' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
          <div style={{ fontSize: '2.5vw', color: GREEN, fontWeight: 800, marginBottom: '1vh' }}>😴 SLEEP</div>
          <div style={{ fontSize: '2.5vw', color: WHITE, fontWeight: 800, marginBottom: '3vh' }}>SCIENCE</div>
          {rightItems.map((item, i) => (
            <motion.div key={i} style={{ display: 'flex', gap: '1vw', alignItems: 'flex-start', marginBottom: '1.8vh' }}
              initial={{ opacity: 0, x: -10 }} animate={ph >= 4 ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
              transition={{ duration: 0.4, delay: 0.12 * i }}>
              <span style={{ color: GREEN, fontSize: '1.5vw', flexShrink: 0 }}>▸</span>
              <span style={{ color: MUTED, fontSize: '1.5vw', lineHeight: 1.4 }}>{item}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── U6: Community ────────────────────────────────────────────────────────────
function U6_Community() {
  const [ph, setPh] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPh(1), 400), setTimeout(() => setPh(2), 2500), setTimeout(() => setPh(3), 5000)];
    return () => t.forEach(clearTimeout);
  }, []);
  const features = ['Share workouts, meals & mood check-ins', 'Celebrate wins together', 'Evidence-based. Inclusive. Moderated.'];
  return (
    <motion.div className="absolute inset-0 z-20 flex flex-col items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(12px)', scale: 1.02 }} transition={{ duration: 0.5 }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 60%, rgba(45,140,78,0.10) 0%, transparent 65%)' }} />
      <div className="text-center px-[8vw] w-full">
        <motion.div style={{ fontSize: '1.8vw', color: GREEN, fontWeight: 700, letterSpacing: '0.2em', marginBottom: '2vh' }}
          initial={{ opacity: 0, y: 10 }} animate={ph >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }} transition={{ duration: 0.5 }}>
          COMMUNITY
        </motion.div>
        <motion.div style={{ fontSize: '5.5vw', color: WHITE, fontWeight: 800, lineHeight: 1.05, marginBottom: '4vh' }}
          initial={{ opacity: 0, y: 20 }} animate={ph >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.7, delay: 0.1 }}>
          HEALTH IS BETTER<br /><span style={{ color: GOLD }}>TOGETHER</span>
        </motion.div>
        {features.map((f, i) => (
          <motion.div key={i} style={{ color: MUTED, fontSize: '2vw', marginBottom: '1.5vh' }}
            initial={{ opacity: 0 }} animate={ph >= 2 ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.5, delay: 0.15 * i }}>
            {f}
          </motion.div>
        ))}
        <motion.div style={{ marginTop: '4vh', fontSize: '1.5vw', color: GREEN }}
          initial={{ opacity: 0 }} animate={ph >= 3 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.6 }}>
          Safe. Inclusive. Evidence-based.
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── U7: Privacy ──────────────────────────────────────────────────────────────
function U7_Privacy() {
  const [ph, setPh] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPh(1), 500), setTimeout(() => setPh(2), 3000), setTimeout(() => setPh(3), 5500)];
    return () => t.forEach(clearTimeout);
  }, []);
  const nevers = ['NEVER sold to any third party', 'NEVER used for advertising', 'NEVER shared with insurers or employers'];
  return (
    <motion.div className="absolute inset-0 z-20 flex flex-col items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(12px)', scale: 1.02 }} transition={{ duration: 0.5 }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(200,168,75,0.08) 0%, transparent 60%)' }} />
      <div className="text-center px-[6vw] w-full">
        <motion.div style={{ fontSize: '3vw', color: MUTED, fontWeight: 700, marginBottom: '3vh' }}
          initial={{ opacity: 0 }} animate={ph >= 1 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.5 }}>
          YOUR DATA IS
        </motion.div>
        <CharReveal text="NEVER SOLD." phase={ph} active={ph >= 1} size="8vw" color={GOLD} delay={0.1} />
        <motion.div className="mx-auto" style={{ height: 3, background: GOLD, marginTop: '3vh' }}
          initial={{ width: 0 }} animate={ph >= 1 ? { width: '25vw' } : { width: 0 }}
          transition={{ duration: 0.8, ease: 'circOut', delay: 0.5 }} />
        <div style={{ marginTop: '5vh', display: 'flex', flexDirection: 'column', gap: '1.8vh', alignItems: 'flex-start', paddingLeft: '15vw' }}>
          {nevers.map((n, i) => (
            <motion.div key={i} style={{ display: 'flex', gap: '1.5vw', alignItems: 'center' }}
              initial={{ opacity: 0, x: -15 }} animate={ph >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -15 }}
              transition={{ duration: 0.5, delay: 0.15 * i }}>
              <div style={{ width: '0.8vw', height: '0.8vw', borderRadius: '50%', background: GREEN, flexShrink: 0 }} />
              <span style={{ color: WHITE, fontSize: '1.8vw' }}><span style={{ color: GOLD, fontWeight: 800 }}>NEVER</span> {n.replace('NEVER ', '')}</span>
            </motion.div>
          ))}
        </div>
        <motion.div style={{ marginTop: '4vh', color: MUTED, fontSize: '1.6vw' }}
          initial={{ opacity: 0 }} animate={ph >= 3 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.6 }}>
          Export your data anytime · Delete your account anytime
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── U8: CTA ──────────────────────────────────────────────────────────────────
function U8_CTA() {
  const [ph, setPh] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPh(1), 400), setTimeout(() => setPh(2), 2500), setTimeout(() => setPh(3), 5000)];
    return () => t.forEach(clearTimeout);
  }, []);
  return (
    <motion.div className="absolute inset-0 z-20 flex flex-col items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05, filter: 'blur(12px)' }} transition={{ duration: 0.5 }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(200,168,75,0.14) 0%, transparent 60%)' }} />
      <div className="text-center px-[8vw] w-full">
        <motion.div style={{ fontSize: '9vw', color: GOLD, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.02em' }}
          initial={{ opacity: 0, scale: 0.9 }} animate={ph >= 1 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}>
          FREE.
        </motion.div>
        <motion.div style={{ fontSize: '9vw', color: WHITE, fontWeight: 900, lineHeight: 1 }}
          initial={{ opacity: 0, scale: 0.9 }} animate={ph >= 1 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22, delay: 0.15 }}>
          ALWAYS.
        </motion.div>
        <motion.div className="mx-auto" style={{ height: 4, background: GREEN, marginTop: '3vh', borderRadius: 2 }}
          initial={{ width: 0 }} animate={ph >= 1 ? { width: '20vw' } : { width: 0 }}
          transition={{ duration: 0.8, ease: 'circOut', delay: 0.3 }} />
        <motion.div style={{ fontSize: '3vw', color: GOLD, fontWeight: 700, marginTop: '4vh', letterSpacing: '0.05em' }}
          initial={{ opacity: 0, y: 10 }} animate={ph >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.6 }}>
          raimzeal.com
        </motion.div>
        <motion.div style={{ fontSize: '1.6vw', color: MUTED, marginTop: '2vh' }}
          initial={{ opacity: 0 }} animate={ph >= 3 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.6 }}>
          App Store · Google Play · Web
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── Scene registry ───────────────────────────────────────────────────────────
const USER_SCENES: Record<string, React.ComponentType> = {
  u1_hook: U1_Hook,
  u2_pillars: U2_Pillars,
  u3_onboard: U3_Onboard,
  u4_fitness_food: U4_FitnessFood,
  u5_mental_sleep: U5_MentalSleep,
  u6_community: U6_Community,
  u7_privacy: U7_Privacy,
  u8_cta: U8_CTA,
};

// ─── Template ─────────────────────────────────────────────────────────────────
export default function VideoUser({
  durations = USER_SCENE_DURATIONS,
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
  const sceneIndex = Object.keys(USER_SCENE_DURATIONS).indexOf(baseKey);
  const SceneComponent = USER_SCENES[baseKey] ?? U1_Hook;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.3;
    audio.play().catch(() => {});
  }, [muted]);

  const bgTints = ['rgba(200,168,75,0.07)', 'rgba(45,140,78,0.07)', 'rgba(200,168,75,0.05)', 'rgba(45,140,78,0.09)', 'rgba(200,168,75,0.06)', 'rgba(45,140,78,0.07)', 'rgba(200,168,75,0.1)', 'rgba(200,168,75,0.12)'];
  const accentTops = ['8%', '25%', '45%', '65%', '80%', '55%', '30%', '15%'];

  return (
    <>
      <div className="relative w-full h-screen overflow-hidden bg-[#0D0D0D]">
        <motion.div className="absolute inset-0 z-0 pointer-events-none"
          animate={{ backgroundColor: bgTints[sceneIndex] ?? bgTints[0] }}
          transition={{ duration: 1.5, ease: 'easeInOut' }} />
        <motion.div className="absolute left-0 right-0 h-[2px] z-10 pointer-events-none"
          style={{ background: GOLD, boxShadow: `0 0 16px rgba(200,168,75,0.6)` }}
          animate={{ top: accentTops[sceneIndex] ?? '50%', opacity: [0.5, 0.8, 0.5][sceneIndex % 3] }}
          transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1] }} />
        {[0, 1, 2].map(i => (
          <motion.div key={i} className="absolute rounded-full pointer-events-none"
            style={{
              width: `${12 + i * 6}vw`, height: `${12 + i * 6}vw`,
              background: `radial-gradient(circle, ${i % 2 === 0 ? 'rgba(200,168,75,0.06)' : 'rgba(45,140,78,0.06)'} 0%, transparent 70%)`,
              filter: 'blur(30px)',
            }}
            animate={{
              x: [`${10 + sceneIndex * 8}vw`, `${20 + i * 15}vw`][i % 2],
              y: [`${15 + sceneIndex * 6}vh`, `${40 + i * 10}vh`][i % 2],
            }}
            transition={{ duration: 3, ease: 'easeInOut' }} />
        ))}
        <AnimatePresence mode="popLayout">
          {SceneComponent && <SceneComponent key={currentSceneKey} />}
        </AnimatePresence>
      </div>
      <audio ref={audioRef} src={`${import.meta.env.BASE_URL}audio/bg_music.mp3`} preload="auto" loop muted={muted} />
    </>
  );
}
