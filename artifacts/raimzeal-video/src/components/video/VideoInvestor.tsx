import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';

export const INVESTOR_SCENE_DURATIONS = {
  i1_open: 10000,
  i2_mission: 10000,
  i3_solution: 12000,
  i4_founder: 10000,
  i5_traction: 10000,
  i6_model: 10000,
  i7_efficiency: 10000,
  i8_cta: 8000,
};

const GOLD = '#C8A84B';
const GREEN = '#2D8C4E';
const WHITE = '#F0EDE8';
const MUTED = '#888888';
const SURFACE = '#1A1A1A';
const BORDER = '#2A2A2A';

function Stat({ value, label, color, active, delay }: { value: string; label: string; color: string; active: boolean; delay: number }) {
  return (
    <motion.div style={{ textAlign: 'center' }}
      initial={{ opacity: 0, y: 20 }} animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ type: 'spring', stiffness: 280, damping: 22, delay }}>
      <div style={{ fontSize: '5vw', color, fontWeight: 900, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '1.2vw', color: MUTED, marginTop: '0.5vh', fontWeight: 500 }}>{label}</div>
    </motion.div>
  );
}

// ─── I1: Cinematic Open ───────────────────────────────────────────────────────
function I1_Open() {
  const [ph, setPh] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPh(1), 600), setTimeout(() => setPh(2), 3500), setTimeout(() => setPh(3), 7000)];
    return () => t.forEach(clearTimeout);
  }, []);
  return (
    <motion.div className="absolute inset-0 z-20 flex flex-col items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(14px)', scale: 1.02 }} transition={{ duration: 0.6 }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 30% 40%, rgba(200,168,75,0.08) 0%, transparent 55%), radial-gradient(ellipse at 75% 70%, rgba(45,140,78,0.06) 0%, transparent 50%)' }} />
      <div style={{ maxWidth: '70vw', textAlign: 'center' }}>
        <motion.div style={{ fontSize: '5vw', color: MUTED, fontWeight: 300, letterSpacing: '0.05em', lineHeight: 1.3, marginBottom: '5vh' }}
          initial={{ opacity: 0 }} animate={ph >= 1 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}>
          47 million Americans<br />have no health insurance.
        </motion.div>
        <motion.div style={{ height: 1, background: GOLD, marginBottom: '5vh' }}
          initial={{ width: 0 }} animate={ph >= 2 ? { width: '100%' } : { width: 0 }}
          transition={{ duration: 1.2, ease: 'circOut' }} />
        <motion.div style={{ fontSize: '4.5vw', color: WHITE, fontWeight: 800, lineHeight: 1.15 }}
          initial={{ opacity: 0, y: 15 }} animate={ph >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
          Healthcare has never been<br />equitably distributed.
        </motion.div>
        <motion.div style={{ fontSize: '4.5vw', color: GOLD, fontWeight: 900, marginTop: '2vh' }}
          initial={{ opacity: 0, y: 15 }} animate={ph >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
          Until now.
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── I2: The Mission ──────────────────────────────────────────────────────────
function I2_Mission() {
  const [ph, setPh] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPh(1), 500), setTimeout(() => setPh(2), 3000), setTimeout(() => setPh(3), 6500)];
    return () => t.forEach(clearTimeout);
  }, []);
  const words = ['EVIDENCE-BASED', 'HEALTHCARE', 'FOR EVERY HUMAN.'];
  const colors = [GOLD, WHITE, GREEN];
  return (
    <motion.div className="absolute inset-0 z-20 flex flex-col items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(14px)', scale: 1.02 }} transition={{ duration: 0.6 }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 45%, rgba(200,168,75,0.13) 0%, transparent 60%)' }} />
      <div style={{ textAlign: 'center', maxWidth: '80vw' }}>
        <motion.div style={{ fontSize: '1.6vw', color: MUTED, letterSpacing: '0.25em', marginBottom: '4vh' }}
          initial={{ opacity: 0 }} animate={ph >= 1 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.6 }}>
          THE MISSION
        </motion.div>
        {words.map((word, i) => (
          <motion.div key={word} style={{ fontSize: '7.5vw', color: colors[i], fontWeight: 900, lineHeight: 1.0 }}
            initial={{ opacity: 0, y: 25 }} animate={ph >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 25 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.15 * i }}>
            {word}
          </motion.div>
        ))}
        <motion.div className="mx-auto" style={{ height: 3, background: GREEN, marginTop: '4vh', borderRadius: 2 }}
          initial={{ width: 0 }} animate={ph >= 2 ? { width: '20vw' } : { width: 0 }}
          transition={{ duration: 0.9, ease: 'circOut' }} />
        <motion.div style={{ fontSize: '2vw', color: MUTED, marginTop: '3vh' }}
          initial={{ opacity: 0 }} animate={ph >= 3 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.7 }}>
          Free. Always. RAIMZEAL.
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── I3: The Solution — 6 Pillars ─────────────────────────────────────────────
function I3_Solution() {
  const [ph, setPh] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPh(1), 400), setTimeout(() => setPh(2), 2200)];
    return () => t.forEach(clearTimeout);
  }, []);
  const pillars = [
    { icon: '💪', label: 'Fitness', detail: 'Personalized programs for every body' },
    { icon: '🥗', label: 'Food Therapy', detail: 'AI meal plans, culturally adaptive' },
    { icon: '🧠', label: 'Mental Wellness', detail: 'Evidence-based CBT, mindfulness, reflections' },
    { icon: '👥', label: 'Community', detail: 'Supportive, moderated, inclusive' },
    { icon: '😴', label: 'Sleep & Recovery', detail: 'Circadian science + recovery protocols' },
    { icon: '🛡️', label: 'Preventive Health', detail: 'Screenings, symptom tracking, risk assessment' },
  ];
  return (
    <motion.div className="absolute inset-0 z-20 flex flex-col justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(14px)', scale: 1.02 }} transition={{ duration: 0.6 }}>
      <div style={{ padding: '3vh 5vw' }}>
        <motion.div style={{ fontSize: '1.4vw', color: GOLD, fontWeight: 700, letterSpacing: '0.2em', marginBottom: '0.8vh' }}
          initial={{ opacity: 0 }} animate={ph >= 1 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.5 }}>
          THE SOLUTION
        </motion.div>
        <motion.div style={{ fontSize: '4vw', color: WHITE, fontWeight: 800, marginBottom: '4vh' }}
          initial={{ opacity: 0, y: 10 }} animate={ph >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.6, delay: 0.1 }}>
          ONE PLATFORM. SIX DISCIPLINES. ZERO COST.
        </motion.div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2vw' }}>
          {pillars.map((p, i) => (
            <motion.div key={p.label} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '1.2vw', padding: '2.5vh 2.5vw' }}
              initial={{ opacity: 0, y: 15 }} animate={ph >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.08 * i }}>
              <div style={{ fontSize: '2.5vw', marginBottom: '1vh' }}>{p.icon}</div>
              <div style={{ color: GOLD, fontWeight: 800, fontSize: '1.4vw', marginBottom: '0.5vh' }}>{p.label}</div>
              <div style={{ color: MUTED, fontSize: '1.1vw', lineHeight: 1.4 }}>{p.detail}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── I4: The Founder ──────────────────────────────────────────────────────────
function I4_Founder() {
  const [ph, setPh] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPh(1), 500), setTimeout(() => setPh(2), 3000), setTimeout(() => setPh(3), 6000)];
    return () => t.forEach(clearTimeout);
  }, []);
  return (
    <motion.div className="absolute inset-0 z-20 flex items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(14px)', scale: 1.02 }} transition={{ duration: 0.6 }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 70% 50%, rgba(200,168,75,0.10) 0%, transparent 55%)' }} />
      <div style={{ display: 'flex', gap: '6vw', alignItems: 'center', padding: '0 8vw' }}>
        {/* Avatar circle */}
        <motion.div style={{ width: '22vw', height: '22vw', borderRadius: '50%', background: `radial-gradient(circle, ${GOLD}22 0%, ${GOLD}08 60%, transparent 100%)`, border: `2px solid ${GOLD}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          initial={{ opacity: 0, scale: 0.85 }} animate={ph >= 1 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.85 }}
          transition={{ type: 'spring', stiffness: 280, damping: 22 }}>
          <div style={{ fontSize: '6vw' }}>👨‍⚕️</div>
        </motion.div>
        <div>
          <motion.div style={{ fontSize: '1.5vw', color: MUTED, letterSpacing: '0.2em', marginBottom: '1vh' }}
            initial={{ opacity: 0 }} animate={ph >= 1 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
            FOUNDER & EXECUTIVE DIRECTOR
          </motion.div>
          <motion.div style={{ fontSize: '5.5vw', color: WHITE, fontWeight: 900, lineHeight: 1, marginBottom: '0.5vh' }}
            initial={{ opacity: 0, y: 15 }} animate={ph >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}>
            Dr. Ephraim
          </motion.div>
          <motion.div style={{ fontSize: '5.5vw', color: GOLD, fontWeight: 900, lineHeight: 1, marginBottom: '3vh' }}
            initial={{ opacity: 0, y: 15 }} animate={ph >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.25 }}>
            Oviawe
          </motion.div>
          <motion.div style={{ height: 2, background: GOLD, marginBottom: '3vh', width: '25vw' }}
            initial={{ width: 0 }} animate={ph >= 1 ? { width: '25vw' } : { width: 0 }}
            transition={{ duration: 0.8, ease: 'circOut', delay: 0.3 }} />
          {['ECONTEUR LLC', 'Built for the underserved', 'Free. Open. Evidence-based.'].map((line, i) => (
            <motion.div key={line} style={{ color: i === 0 ? WHITE : MUTED, fontSize: '1.6vw', fontWeight: i === 0 ? 700 : 400, marginBottom: '1vh' }}
              initial={{ opacity: 0, x: -10 }} animate={ph >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
              transition={{ duration: 0.5, delay: 0.1 * i }}>
              {line}
            </motion.div>
          ))}
          <motion.div style={{ marginTop: '2.5vh', fontSize: '1.4vw', color: GREEN, fontWeight: 600 }}
            initial={{ opacity: 0 }} animate={ph >= 3 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.6 }}>
            "Every person deserves evidence-based health guidance."
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── I5: Traction ─────────────────────────────────────────────────────────────
function I5_Traction() {
  const [ph, setPh] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPh(1), 400), setTimeout(() => setPh(2), 2000), setTimeout(() => setPh(3), 5500)];
    return () => t.forEach(clearTimeout);
  }, []);
  const timeline = [
    { label: 'Web App Live', date: 'Q1 2026', color: GREEN, done: true },
    { label: 'iOS App Store', date: 'Q2 2026', color: GOLD, done: true },
    { label: 'Android Google Play', date: 'Q3 2026', color: GOLD, done: false },
    { label: '501(c)(3) Foundation', date: 'Q3 2026', color: WHITE, done: false },
    { label: 'NIH SBIR Phase I', date: 'Q3 2026', color: GREEN, done: false },
    { label: 'First Major Grant', date: 'H1 2027', color: MUTED, done: false },
  ];
  return (
    <motion.div className="absolute inset-0 z-20 flex flex-col justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(14px)', scale: 1.02 }} transition={{ duration: 0.6 }}>
      <div style={{ padding: '4vh 5vw' }}>
        <motion.div style={{ fontSize: '1.4vw', color: GOLD, fontWeight: 700, letterSpacing: '0.2em', marginBottom: '1vh' }}
          initial={{ opacity: 0 }} animate={ph >= 1 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.5 }}>
          TRACTION & ROADMAP
        </motion.div>
        <motion.div style={{ fontSize: '4vw', color: WHITE, fontWeight: 800, marginBottom: '5vh' }}
          initial={{ opacity: 0, y: 10 }} animate={ph >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.6, delay: 0.1 }}>
          THE MISSION IS IN MOTION
        </motion.div>
        <div style={{ position: 'relative', paddingLeft: '3vw' }}>
          <div style={{ position: 'absolute', left: '1.5vw', top: 0, bottom: 0, width: 2, background: BORDER }} />
          {timeline.map((item, i) => (
            <motion.div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '2.5vw', marginBottom: '2.5vh', position: 'relative' }}
              initial={{ opacity: 0, x: -15 }} animate={ph >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -15 }}
              transition={{ duration: 0.45, delay: 0.1 * i }}>
              <div style={{ position: 'absolute', left: '-2.35vw', width: '1.2vw', height: '1.2vw', borderRadius: '50%', background: item.done ? GREEN : SURFACE, border: `2px solid ${item.color}`, flexShrink: 0 }} />
              <div style={{ fontSize: '1.6vw', color: item.done ? WHITE : MUTED, fontWeight: item.done ? 700 : 400 }}>{item.label}</div>
              <div style={{ fontSize: '1.2vw', color: item.color, fontWeight: 600, background: item.color + '18', border: `1px solid ${item.color}40`, borderRadius: 999, padding: '0.3vh 1.2vw' }}>{item.date}</div>
              {item.done && <div style={{ fontSize: '1.1vw', color: GREEN, fontWeight: 700 }}>✓ Live</div>}
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── I6: Business Model ───────────────────────────────────────────────────────
function I6_Model() {
  const [ph, setPh] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPh(1), 400), setTimeout(() => setPh(2), 2200), setTimeout(() => setPh(3), 6000)];
    return () => t.forEach(clearTimeout);
  }, []);
  const streams = [
    { icon: '🏛️', label: 'Grants', detail: 'NIH, RWJF, Gates Foundation, CDC PRC', color: GOLD },
    { icon: '🏥', label: 'Institutional Partnerships', detail: 'Hospital systems, HBCUs, FQHCs — zero revenue from users', color: GREEN },
    { icon: '🏢', label: 'Corporate Wellness', detail: 'Employers offer RAIMZEAL free to employees', color: '#60a5fa' },
  ];
  return (
    <motion.div className="absolute inset-0 z-20 flex flex-col justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(14px)', scale: 1.02 }} transition={{ duration: 0.6 }}>
      <div style={{ padding: '4vh 5vw' }}>
        <motion.div style={{ fontSize: '1.4vw', color: GOLD, fontWeight: 700, letterSpacing: '0.2em', marginBottom: '1vh' }}
          initial={{ opacity: 0 }} animate={ph >= 1 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.5 }}>
          BUSINESS MODEL
        </motion.div>
        <motion.div style={{ fontSize: '4vw', color: WHITE, fontWeight: 800, marginBottom: '2vh' }}
          initial={{ opacity: 0, y: 10 }} animate={ph >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.6, delay: 0.1 }}>
          ZERO ADS. ZERO PAYWALLS.
        </motion.div>
        <motion.div style={{ fontSize: '2vw', color: MUTED, marginBottom: '4vh' }}
          initial={{ opacity: 0 }} animate={ph >= 1 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
          Sustained by grants and institutional partnerships — never by monetising users.
        </motion.div>
        <div style={{ display: 'flex', gap: '2.5vw' }}>
          {streams.map((s, i) => (
            <motion.div key={s.label} style={{ flex: 1, background: SURFACE, border: `1px solid ${s.color}40`, borderTop: `4px solid ${s.color}`, borderRadius: '1.2vw', padding: '3vh 2.5vw' }}
              initial={{ opacity: 0, y: 20 }} animate={ph >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.12 * i }}>
              <div style={{ fontSize: '3vw', marginBottom: '1.5vh' }}>{s.icon}</div>
              <div style={{ color: s.color, fontWeight: 800, fontSize: '1.5vw', marginBottom: '1vh' }}>{s.label}</div>
              <div style={{ color: MUTED, fontSize: '1.2vw', lineHeight: 1.5 }}>{s.detail}</div>
            </motion.div>
          ))}
        </div>
        <motion.div style={{ marginTop: '4vh', display: 'flex', gap: '4vw', justifyContent: 'center' }}
          initial={{ opacity: 0 }} animate={ph >= 3 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.6 }}>
          <Stat value="$0" label="User revenue" color={GREEN} active={ph >= 3} delay={0} />
          <Stat value="100%" label="Mission-aligned funding" color={GOLD} active={ph >= 3} delay={0.1} />
          <Stat value="∞" label="Years of free access" color={WHITE} active={ph >= 3} delay={0.2} />
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── I7: Cost Efficiency ──────────────────────────────────────────────────────
function I7_Efficiency() {
  const [ph, setPh] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPh(1), 400), setTimeout(() => setPh(2), 2500), setTimeout(() => setPh(3), 6000)];
    return () => t.forEach(clearTimeout);
  }, []);
  return (
    <motion.div className="absolute inset-0 z-20 flex flex-col justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(14px)', scale: 1.02 }} transition={{ duration: 0.6 }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 60% 40%, rgba(200,168,75,0.10) 0%, transparent 55%)' }} />
      <div style={{ padding: '4vh 5vw' }}>
        <motion.div style={{ fontSize: '1.4vw', color: GOLD, fontWeight: 700, letterSpacing: '0.2em', marginBottom: '1vh' }}
          initial={{ opacity: 0 }} animate={ph >= 1 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.5 }}>
          UNPRECEDENTED COST EFFICIENCY
        </motion.div>
        <motion.div style={{ fontSize: '4vw', color: WHITE, fontWeight: 800, marginBottom: '5vh' }}
          initial={{ opacity: 0, y: 10 }} animate={ph >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.6, delay: 0.1 }}>
          DIGITAL HEALTH HAS NEVER LOOKED LIKE THIS
        </motion.div>
        <motion.div style={{ display: 'flex', gap: '3vw', marginBottom: '5vh' }}
          initial={{ opacity: 0 }} animate={ph >= 2 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.7 }}>
          <div style={{ flex: 1, background: '#1a0a0a', border: `1px solid #ef444430`, borderRadius: '1.2vw', padding: '3vh 3vw' }}>
            <div style={{ color: MUTED, fontSize: '1.3vw', marginBottom: '1vh' }}>TYPICAL DIGITAL HEALTH STARTUP</div>
            <div style={{ color: '#ef4444', fontWeight: 900, fontSize: '5vw', lineHeight: 1 }}>$20–50</div>
            <div style={{ color: MUTED, fontSize: '1.4vw' }}>per user per month</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', color: MUTED, fontSize: '3vw', fontWeight: 300 }}>vs</div>
          <div style={{ flex: 1, background: '#0a1a0a', border: `1px solid ${GREEN}40`, borderRadius: '1.2vw', padding: '3vh 3vw' }}>
            <div style={{ color: MUTED, fontSize: '1.3vw', marginBottom: '1vh' }}>RAIMZEAL</div>
            <div style={{ color: GREEN, fontWeight: 900, fontSize: '5vw', lineHeight: 1 }}>$0.001</div>
            <div style={{ color: MUTED, fontSize: '1.4vw' }}>per user per month at 50K MAU</div>
          </div>
        </motion.div>
        <motion.div style={{ display: 'flex', gap: '3vw', justifyContent: 'center' }}
          initial={{ opacity: 0 }} animate={ph >= 3 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.6 }}>
          <Stat value="50,000" label="Users served" color={WHITE} active={ph >= 3} delay={0} />
          <Stat value="$51" label="Total monthly cost" color={GOLD} active={ph >= 3} delay={0.1} />
          <Stat value="99.97%" label="Cost reduction vs peers" color={GREEN} active={ph >= 3} delay={0.2} />
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── I8: CTA ──────────────────────────────────────────────────────────────────
function I8_CTA() {
  const [ph, setPh] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPh(1), 500), setTimeout(() => setPh(2), 3000), setTimeout(() => setPh(3), 5500)];
    return () => t.forEach(clearTimeout);
  }, []);
  return (
    <motion.div className="absolute inset-0 z-20 flex flex-col items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05, filter: 'blur(14px)' }} transition={{ duration: 0.6 }}>
      <div className="absolute left-0 top-0 bottom-0 w-[4px]" style={{ background: GOLD }} />
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(200,168,75,0.14) 0%, transparent 58%)' }} />
      <div style={{ textAlign: 'center', maxWidth: '75vw' }}>
        <motion.div style={{ fontSize: '12vw', color: GOLD, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.02em' }}
          initial={{ opacity: 0, scale: 0.88 }} animate={ph >= 1 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.88 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}>
          RAIMZEAL
        </motion.div>
        <motion.div style={{ display: 'flex', gap: '3vw', justifyContent: 'center', marginTop: '2vh', marginBottom: '4vh' }}
          initial={{ opacity: 0, y: 10 }} animate={ph >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.6, delay: 0.2 }}>
          {['Free', 'Open', 'Evidence-Based'].map((w, i) => (
            <span key={w} style={{ fontSize: '2.5vw', color: i === 0 ? GREEN : i === 1 ? WHITE : GOLD, fontWeight: 700 }}>{w}</span>
          ))}
        </motion.div>
        <motion.div className="mx-auto" style={{ height: 3, background: GREEN, borderRadius: 2 }}
          initial={{ width: 0 }} animate={ph >= 1 ? { width: '40vw' } : { width: 0 }}
          transition={{ duration: 1, ease: 'circOut', delay: 0.3 }} />
        <motion.div style={{ fontSize: '3.5vw', color: WHITE, fontWeight: 700, marginTop: '4vh' }}
          initial={{ opacity: 0, y: 10 }} animate={ph >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.6 }}>
          Join the mission at raimzeal.com
        </motion.div>
        <motion.div style={{ fontSize: '1.5vw', color: MUTED, marginTop: '2vh' }}
          initial={{ opacity: 0 }} animate={ph >= 3 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.6 }}>
          Dr. Ephraim Oviawe · ECONTEUR LLC · Healthcare equity for every human on earth
        </motion.div>
      </div>
    </motion.div>
  );
}

const INVESTOR_SCENES: Record<string, React.ComponentType> = {
  i1_open: I1_Open, i2_mission: I2_Mission, i3_solution: I3_Solution,
  i4_founder: I4_Founder, i5_traction: I5_Traction, i6_model: I6_Model,
  i7_efficiency: I7_Efficiency, i8_cta: I8_CTA,
};

export default function VideoInvestor({
  durations = INVESTOR_SCENE_DURATIONS,
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
  const sceneIndex = Object.keys(INVESTOR_SCENE_DURATIONS).indexOf(baseKey);
  const SceneComponent = INVESTOR_SCENES[baseKey] ?? I1_Open;
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.28;
    audio.play().catch(() => {});
  }, [muted]);
  const bgTints = ['rgba(200,168,75,0.07)', 'rgba(200,168,75,0.13)', 'rgba(45,140,78,0.07)', 'rgba(200,168,75,0.09)', 'rgba(45,140,78,0.07)', 'rgba(200,168,75,0.06)', 'rgba(200,168,75,0.10)', 'rgba(200,168,75,0.14)'];
  const accentTops = ['90%', '8%', '50%', '25%', '70%', '35%', '55%', '15%'];
  return (
    <>
      <div className="relative w-full h-screen overflow-hidden bg-[#0a0a0a]">
        <motion.div className="absolute inset-0 z-0 pointer-events-none"
          animate={{ backgroundColor: bgTints[sceneIndex] ?? bgTints[0] }} transition={{ duration: 2, ease: 'easeInOut' }} />
        <motion.div className="absolute left-0 right-0 h-[2px] z-10 pointer-events-none"
          style={{ background: GOLD, boxShadow: `0 0 20px rgba(200,168,75,0.6)` }}
          animate={{ top: accentTops[sceneIndex] ?? '50%' }} transition={{ duration: 2.5, ease: [0.22, 1, 0.36, 1] }} />
        <AnimatePresence mode="popLayout">
          {SceneComponent && <SceneComponent key={currentSceneKey} />}
        </AnimatePresence>
      </div>
      <audio ref={audioRef} src={`${import.meta.env.BASE_URL}audio/bg_music.mp3`} preload="auto" loop muted={muted} />
    </>
  );
}
