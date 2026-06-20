import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';

export const OPS_SCENE_DURATIONS = {
  o1_hook: 8000,
  o2_costs: 12000,
  o3_runway: 12000,
  o4_maintenance: 10000,
  o5_foundation: 10000,
  o6_scaling: 10000,
  o7_cta: 8000,
};

const GOLD = '#C8A84B';
const GREEN = '#2D8C4E';
const WHITE = '#F0EDE8';
const MUTED = '#888888';
const SURFACE = '#1A1A1A';
const BORDER = '#2A2A2A';

// ─── O1: Hook — $50.75 ────────────────────────────────────────────────────────
function O1_Hook() {
  const [ph, setPh] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPh(1), 400), setTimeout(() => setPh(2), 2800), setTimeout(() => setPh(3), 5500)];
    return () => t.forEach(clearTimeout);
  }, []);
  return (
    <motion.div className="absolute inset-0 z-20 flex flex-col items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(12px)', scale: 1.02 }} transition={{ duration: 0.5 }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(200,168,75,0.14) 0%, transparent 60%)' }} />
      <div className="text-center px-[6vw] w-full">
        <motion.div style={{ fontSize: '18vw', color: GOLD, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.03em' }}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={ph >= 1 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.85 }}
          transition={{ type: 'spring', stiffness: 280, damping: 22 }}>
          $50.75
        </motion.div>
        <motion.div style={{ fontSize: '3vw', color: WHITE, fontWeight: 700, marginTop: '1vh' }}
          initial={{ opacity: 0, y: 10 }} animate={ph >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.6, delay: 0.3 }}>
          PER MONTH
        </motion.div>
        <motion.div className="mx-auto" style={{ height: 3, background: GOLD, marginTop: '2.5vh', borderRadius: 2 }}
          initial={{ width: 0 }} animate={ph >= 1 ? { width: '22vw' } : { width: 0 }}
          transition={{ duration: 0.8, ease: 'circOut', delay: 0.4 }} />
        <motion.div style={{ fontSize: '2.5vw', color: MUTED, marginTop: '3vh' }}
          initial={{ opacity: 0 }} animate={ph >= 2 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.6 }}>
          50,000 users · Zero ads · Zero paywalls · Zero compromise
        </motion.div>
        <motion.div style={{ display: 'inline-flex', gap: '1.5vw', marginTop: '4vh' }}
          initial={{ opacity: 0, y: 10 }} animate={ph >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.6 }}>
          {['Replit $19', 'EAS $19', 'Apple $8.25', 'OpenAI $3', 'Domain $1.50', 'Supabase FREE'].map((item, i) => (
            <div key={i} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 999, padding: '0.6vh 1.5vw', color: MUTED, fontSize: '1.1vw' }}>
              {item}
            </div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── O2: Cost Breakdown ───────────────────────────────────────────────────────
function O2_Costs() {
  const [ph, setPh] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPh(1), 300), setTimeout(() => setPh(2), 1800)];
    return () => t.forEach(clearTimeout);
  }, []);
  const rows = [
    { service: 'Replit (API + Web)', plan: 'Starter', cost: '$19.00/mo', note: 'All artifacts' },
    { service: 'EAS (Expo)', plan: 'Starter', cost: '$19.00/mo', note: 'iOS + Android builds' },
    { service: 'Apple Developer', plan: 'Individual', cost: '~$8.25/mo', note: 'Billed annually' },
    { service: 'Supabase', plan: 'Free', cost: '$0.00', note: '50K MAU, 500MB' },
    { service: 'OpenAI API', plan: 'Pay-as-you-go', cost: '~$3.00/mo', note: 'AI meal plans' },
    { service: 'Domain', plan: 'Annual', cost: '~$1.50/mo', note: 'raimzeal.com' },
  ];
  return (
    <motion.div className="absolute inset-0 z-20 flex flex-col justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(12px)', scale: 1.02 }} transition={{ duration: 0.5 }}>
      <div style={{ padding: '4vh 5vw' }}>
        <motion.div style={{ fontSize: '1.4vw', color: GOLD, fontWeight: 700, letterSpacing: '0.2em', marginBottom: '1vh' }}
          initial={{ opacity: 0 }} animate={ph >= 1 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.5 }}>
          MONTHLY COST BREAKDOWN
        </motion.div>
        <motion.div style={{ fontSize: '4vw', color: WHITE, fontWeight: 800, marginBottom: '4vh' }}
          initial={{ opacity: 0, y: 10 }} animate={ph >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.6, delay: 0.1 }}>
          WHERE EVERY DOLLAR GOES
        </motion.div>
        <div style={{ background: SURFACE, borderRadius: '1vw', overflow: 'hidden', border: `1px solid ${BORDER}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.5fr', background: '#111', padding: '1.2vh 2vw', borderBottom: `1px solid ${BORDER}` }}>
            {['SERVICE', 'PLAN', 'COST', 'NOTES'].map((h) => (
              <div key={h} style={{ color: GOLD, fontWeight: 700, fontSize: '1.1vw', letterSpacing: '0.1em' }}>{h}</div>
            ))}
          </div>
          {rows.map((r, i) => (
            <motion.div key={r.service} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.5fr', padding: '1.2vh 2vw', background: i % 2 === 0 ? 'transparent' : '#111', borderBottom: i < rows.length - 1 ? `1px solid ${BORDER}` : 'none' }}
              initial={{ opacity: 0, x: -10 }} animate={ph >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
              transition={{ duration: 0.4, delay: 0.08 * i }}>
              <div style={{ color: WHITE, fontWeight: 600, fontSize: '1.2vw' }}>{r.service}</div>
              <div style={{ color: MUTED, fontSize: '1.1vw' }}>{r.plan}</div>
              <div style={{ color: r.cost === '$0.00' ? GREEN : GOLD, fontWeight: 700, fontSize: '1.2vw' }}>{r.cost}</div>
              <div style={{ color: MUTED, fontSize: '1.1vw' }}>{r.note}</div>
            </motion.div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.5fr', padding: '1.5vh 2vw', background: '#0a0a0a', borderTop: `2px solid ${GOLD}` }}>
            <div style={{ color: WHITE, fontWeight: 800, fontSize: '1.4vw' }}>TOTAL</div>
            <div />
            <div style={{ color: GOLD, fontWeight: 900, fontSize: '1.6vw' }}>$50.75</div>
            <div style={{ color: MUTED, fontSize: '1.1vw' }}>Per month</div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── O3: Grant Runway ─────────────────────────────────────────────────────────
function O3_Runway() {
  const [ph, setPh] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPh(1), 400), setTimeout(() => setPh(2), 2000), setTimeout(() => setPh(3), 6000)];
    return () => t.forEach(clearTimeout);
  }, []);
  const grants = [
    { amount: '$10,000', years: '16 years', pct: 16 },
    { amount: '$50,000', years: '82 years', pct: 35 },
    { amount: '$250,000', years: '410 years', pct: 60 },
    { amount: '$1,000,000', years: '1,642 years', pct: 100 },
  ];
  return (
    <motion.div className="absolute inset-0 z-20 flex flex-col justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(12px)', scale: 1.02 }} transition={{ duration: 0.5 }}>
      <div style={{ padding: '4vh 5vw' }}>
        <motion.div style={{ fontSize: '1.4vw', color: GOLD, fontWeight: 700, letterSpacing: '0.2em', marginBottom: '1vh' }}
          initial={{ opacity: 0 }} animate={ph >= 1 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.5 }}>
          GRANT RUNWAY ANALYSIS
        </motion.div>
        <motion.div style={{ fontSize: '4vw', color: WHITE, fontWeight: 800, marginBottom: '6vh' }}
          initial={{ opacity: 0, y: 10 }} animate={ph >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.6, delay: 0.1 }}>
          ONE GRANT. GENERATIONS OF IMPACT.
        </motion.div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5vh' }}>
          {grants.map((g, i) => (
            <motion.div key={g.amount} style={{ display: 'flex', alignItems: 'center', gap: '3vw' }}
              initial={{ opacity: 0, x: -20 }} animate={ph >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
              transition={{ duration: 0.5, delay: 0.12 * i }}>
              <div style={{ color: GOLD, fontWeight: 900, fontSize: '1.8vw', minWidth: '12vw', textAlign: 'right' }}>{g.amount}</div>
              <div style={{ flex: 1, height: '2.5vh', background: SURFACE, borderRadius: 999, overflow: 'hidden', position: 'relative' }}>
                <motion.div style={{ position: 'absolute', inset: '0 auto 0 0', background: `linear-gradient(90deg, ${GOLD}, ${GREEN})`, borderRadius: 999 }}
                  initial={{ width: 0 }} animate={ph >= 2 ? { width: `${g.pct}%` } : { width: 0 }}
                  transition={{ duration: 0.8, ease: 'circOut', delay: 0.12 * i + 0.2 }} />
              </div>
              <div style={{ color: WHITE, fontWeight: 700, fontSize: '1.8vw', minWidth: '12vw' }}>{g.years}</div>
            </motion.div>
          ))}
        </div>
        <motion.div style={{ marginTop: '5vh', padding: '2vh 2.5vw', background: GREEN + '15', border: `1px solid ${GREEN}`, borderRadius: '1vw', fontSize: '1.8vw', color: WHITE, fontWeight: 600 }}
          initial={{ opacity: 0, y: 10 }} animate={ph >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.6 }}>
          Every grant dollar goes to impact — not infrastructure overhead.
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── O4: Maintenance ──────────────────────────────────────────────────────────
function O4_Maintenance() {
  const [ph, setPh] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPh(1), 400), setTimeout(() => setPh(2), 2000)];
    return () => t.forEach(clearTimeout);
  }, []);
  const schedule = [
    { freq: 'DAILY', time: '5 min', items: ['Healthcheck endpoint', 'Review bug reports', 'Supabase error alerts'], color: GOLD },
    { freq: 'WEEKLY', time: '30 min', items: ['Community moderation', 'OpenAI cost monitoring', 'Supabase performance'], color: GREEN },
    { freq: 'MONTHLY', time: '2–3 hrs', items: ['Security updates + typecheck', 'Privacy policy review', 'New app release'], color: '#60a5fa' },
    { freq: 'ANNUALLY', time: '', items: ['Renew Apple Developer ($99)', 'Full security audit', 'GDPR / HIPAA review'], color: MUTED },
  ];
  return (
    <motion.div className="absolute inset-0 z-20 flex flex-col justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(12px)', scale: 1.02 }} transition={{ duration: 0.5 }}>
      <div style={{ padding: '4vh 5vw' }}>
        <motion.div style={{ fontSize: '1.4vw', color: GOLD, fontWeight: 700, letterSpacing: '0.2em', marginBottom: '1vh' }}
          initial={{ opacity: 0 }} animate={ph >= 1 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.5 }}>
          MAINTENANCE SCHEDULE
        </motion.div>
        <motion.div style={{ fontSize: '4vw', color: WHITE, fontWeight: 800, marginBottom: '4vh' }}
          initial={{ opacity: 0, y: 10 }} animate={ph >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.6, delay: 0.1 }}>
          DESIGNED TO BE LEAN
        </motion.div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2vw' }}>
          {schedule.map((s, i) => (
            <motion.div key={s.freq} style={{ background: SURFACE, border: `1px solid ${s.color}40`, borderTop: `3px solid ${s.color}`, borderRadius: '1vw', padding: '2.5vh 2vw' }}
              initial={{ opacity: 0, y: 15 }} animate={ph >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
              transition={{ duration: 0.5, delay: 0.1 * i }}>
              <div style={{ color: s.color, fontWeight: 800, fontSize: '1.5vw', marginBottom: '0.5vh' }}>{s.freq}</div>
              {s.time && <div style={{ color: MUTED, fontSize: '1.1vw', marginBottom: '1.5vh' }}>{s.time}</div>}
              {s.items.map((item, j) => (
                <div key={j} style={{ color: MUTED, fontSize: '1.1vw', marginBottom: '0.7vh', lineHeight: 1.4 }}>· {item}</div>
              ))}
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── O5: 501(c)(3) + Grants ───────────────────────────────────────────────────
function O5_Foundation() {
  const [ph, setPh] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPh(1), 400), setTimeout(() => setPh(2), 2200), setTimeout(() => setPh(3), 6000)];
    return () => t.forEach(clearTimeout);
  }, []);
  const steps = ['Incorporate (state filing, $50–$200)', 'Obtain EIN from IRS (free, same day)', 'Draft bylaws + conflict of interest policy', 'File IRS Form 1023-EZ ($275, 2–6 weeks)', 'Receive tax-exempt determination letter'];
  const grants = [{ name: 'NIH SBIR Phase I', amount: 'up to $300K' }, { name: 'Robert Wood Johnson Foundation', amount: '$50K–$500K' }, { name: 'Gates Foundation', amount: '$100K–$2M' }];
  return (
    <motion.div className="absolute inset-0 z-20 flex flex-col justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(12px)', scale: 1.02 }} transition={{ duration: 0.5 }}>
      <div style={{ display: 'flex', padding: '4vh 5vw', gap: '4vw', height: '100%', alignItems: 'center' }}>
        {/* Left: 501c3 */}
        <div style={{ flex: 1 }}>
          <motion.div style={{ fontSize: '1.4vw', color: GOLD, fontWeight: 700, letterSpacing: '0.2em', marginBottom: '1vh' }}
            initial={{ opacity: 0 }} animate={ph >= 1 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.5 }}>
            501(c)(3) PATH
          </motion.div>
          <motion.div style={{ fontSize: '3vw', color: WHITE, fontWeight: 800, marginBottom: '3vh' }}
            initial={{ opacity: 0, y: 10 }} animate={ph >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
            transition={{ duration: 0.6, delay: 0.1 }}>
            RAIMZEAL Health<br />Foundation
          </motion.div>
          {steps.map((s, i) => (
            <motion.div key={i} style={{ display: 'flex', gap: '1.5vw', alignItems: 'flex-start', marginBottom: '1.5vh' }}
              initial={{ opacity: 0, x: -10 }} animate={ph >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
              transition={{ duration: 0.4, delay: 0.1 * i }}>
              <div style={{ width: '2.2vw', height: '2.2vw', borderRadius: '50%', background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: WHITE, fontSize: '1vw', fontWeight: 800 }}>{i + 1}</span>
              </div>
              <span style={{ color: MUTED, fontSize: '1.2vw', lineHeight: 1.4 }}>{s}</span>
            </motion.div>
          ))}
        </div>
        {/* Right: Grants */}
        <div style={{ flex: 1 }}>
          <motion.div style={{ fontSize: '1.4vw', color: GREEN, fontWeight: 700, letterSpacing: '0.2em', marginBottom: '1vh' }}
            initial={{ opacity: 0 }} animate={ph >= 1 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.5 }}>
            GRANT TARGETS
          </motion.div>
          <motion.div style={{ fontSize: '3vw', color: WHITE, fontWeight: 800, marginBottom: '3vh' }}
            initial={{ opacity: 0, y: 10 }} animate={ph >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
            transition={{ duration: 0.6, delay: 0.1 }}>
            Priority Pipeline
          </motion.div>
          {grants.map((g, i) => (
            <motion.div key={g.name} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${GOLD}`, borderRadius: '0.8vw', padding: '2vh 2vw', marginBottom: '2vh' }}
              initial={{ opacity: 0, x: 15 }} animate={ph >= 3 ? { opacity: 1, x: 0 } : { opacity: 0, x: 15 }}
              transition={{ duration: 0.5, delay: 0.1 * i }}>
              <div style={{ color: WHITE, fontWeight: 700, fontSize: '1.3vw', marginBottom: '0.3vh' }}>{g.name}</div>
              <div style={{ color: GOLD, fontWeight: 800, fontSize: '1.5vw' }}>{g.amount}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── O6: Scaling ──────────────────────────────────────────────────────────────
function O6_Scaling() {
  const [ph, setPh] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPh(1), 400), setTimeout(() => setPh(2), 2000)];
    return () => t.forEach(clearTimeout);
  }, []);
  const tiers = [
    { mau: '0–50K', cost: '$51/mo', note: 'Current setup. No changes needed.', pct: 5, color: GREEN },
    { mau: '50K–500K', cost: '$100–200/mo', note: 'Supabase Pro + Replit Autoscale scale-up', pct: 25, color: GOLD },
    { mau: '500K–5M', cost: '$500–2K/mo', note: 'Supabase Team + dedicated cloud API + Redis', pct: 60, color: '#f97316' },
    { mau: '5M+', cost: 'Grant-funded engineer', note: 'SRE practice + horizontal scaling + WHO partnership', pct: 100, color: '#ef4444' },
  ];
  return (
    <motion.div className="absolute inset-0 z-20 flex flex-col justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(12px)', scale: 1.02 }} transition={{ duration: 0.5 }}>
      <div style={{ padding: '4vh 5vw' }}>
        <motion.div style={{ fontSize: '1.4vw', color: GOLD, fontWeight: 700, letterSpacing: '0.2em', marginBottom: '1vh' }}
          initial={{ opacity: 0 }} animate={ph >= 1 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.5 }}>
          SCALING PLAN
        </motion.div>
        <motion.div style={{ fontSize: '4vw', color: WHITE, fontWeight: 800, marginBottom: '5vh' }}
          initial={{ opacity: 0, y: 10 }} animate={ph >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.6, delay: 0.1 }}>
          FROM 50K TO 5M USERS
        </motion.div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5vh' }}>
          {tiers.map((tier, i) => (
            <motion.div key={tier.mau}
              initial={{ opacity: 0, x: -20 }} animate={ph >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
              transition={{ duration: 0.5, delay: 0.1 * i }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8vh' }}>
                <span style={{ color: tier.color, fontWeight: 800, fontSize: '1.4vw' }}>{tier.mau} MAU</span>
                <span style={{ color: WHITE, fontWeight: 700, fontSize: '1.4vw' }}>{tier.cost}</span>
              </div>
              <div style={{ height: '1.8vh', background: SURFACE, borderRadius: 999, overflow: 'hidden', marginBottom: '0.5vh' }}>
                <motion.div style={{ height: '100%', background: tier.color, borderRadius: 999 }}
                  initial={{ width: 0 }} animate={ph >= 2 ? { width: `${tier.pct}%` } : { width: 0 }}
                  transition={{ duration: 0.8, ease: 'circOut', delay: 0.1 * i + 0.2 }} />
              </div>
              <div style={{ color: MUTED, fontSize: '1.1vw' }}>{tier.note}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── O7: CTA ──────────────────────────────────────────────────────────────────
function O7_CTA() {
  const [ph, setPh] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPh(1), 400), setTimeout(() => setPh(2), 2800), setTimeout(() => setPh(3), 5200)];
    return () => t.forEach(clearTimeout);
  }, []);
  return (
    <motion.div className="absolute inset-0 z-20 flex flex-col items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05, filter: 'blur(12px)' }} transition={{ duration: 0.5 }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(200,168,75,0.12) 0%, transparent 55%)' }} />
      <div className="text-center px-[8vw] w-full">
        <motion.div style={{ fontSize: '2.5vw', color: MUTED, marginBottom: '3vh' }}
          initial={{ opacity: 0 }} animate={ph >= 1 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.6 }}>
          THE MOST COST-EFFICIENT HEALTH MISSION ON EARTH
        </motion.div>
        <motion.div style={{ fontSize: '7vw', color: GOLD, fontWeight: 900, lineHeight: 1 }}
          initial={{ opacity: 0, scale: 0.9 }} animate={ph >= 1 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22, delay: 0.1 }}>
          PARTNER.
        </motion.div>
        <motion.div style={{ fontSize: '7vw', color: WHITE, fontWeight: 900, lineHeight: 1 }}
          initial={{ opacity: 0, scale: 0.9 }} animate={ph >= 1 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22, delay: 0.2 }}>
          FUND.
        </motion.div>
        <motion.div style={{ fontSize: '7vw', color: GREEN, fontWeight: 900, lineHeight: 1, marginBottom: '5vh' }}
          initial={{ opacity: 0, scale: 0.9 }} animate={ph >= 1 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22, delay: 0.3 }}>
          HEAL.
        </motion.div>
        <motion.div style={{ fontSize: '2.8vw', color: GOLD, fontWeight: 700 }}
          initial={{ opacity: 0, y: 10 }} animate={ph >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.6 }}>
          raimzeal.com
        </motion.div>
        <motion.div style={{ fontSize: '1.5vw', color: MUTED, marginTop: '1.5vh' }}
          initial={{ opacity: 0 }} animate={ph >= 3 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.5 }}>
          ECONTEUR LLC · Dr. Ephraim Oviawe · Free · Open · Evidence-Based
        </motion.div>
      </div>
    </motion.div>
  );
}

const OPS_SCENES: Record<string, React.ComponentType> = {
  o1_hook: O1_Hook, o2_costs: O2_Costs, o3_runway: O3_Runway,
  o4_maintenance: O4_Maintenance, o5_foundation: O5_Foundation,
  o6_scaling: O6_Scaling, o7_cta: O7_CTA,
};

export default function VideoOps({
  durations = OPS_SCENE_DURATIONS,
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
  const sceneIndex = Object.keys(OPS_SCENE_DURATIONS).indexOf(baseKey);
  const SceneComponent = OPS_SCENES[baseKey] ?? O1_Hook;
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.3;
    audio.play().catch(() => {});
  }, [muted]);
  const bgTints = ['rgba(200,168,75,0.12)', 'rgba(200,168,75,0.06)', 'rgba(200,168,75,0.06)', 'rgba(45,140,78,0.06)', 'rgba(45,140,78,0.07)', 'rgba(200,168,75,0.06)', 'rgba(200,168,75,0.10)'];
  const accentTops = ['5%', '20%', '40%', '60%', '75%', '50%', '15%'];
  return (
    <>
      <div className="relative w-full h-screen overflow-hidden bg-[#0D0D0D]">
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
