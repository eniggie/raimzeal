import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2000),
      setTimeout(() => setPhase(4), 2800),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-end px-[10vw] z-20 bg-black/40"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
      transition={{ duration: 0.6 }}
    >
      <div className="absolute left-[15vw] top-[50%] -translate-y-1/2 w-[35vw] h-[35vw]">
        <motion.div 
          className="w-full h-full rounded-full border border-[#00FF7F]/30 flex items-center justify-center relative shadow-[0_0_80px_rgba(0,255,127,0.2)]"
          animate={{ rotate: 360, scale: [1, 1.05, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        >
          <motion.div className="w-[60%] h-[60%] border-2 border-[#00FF7F]/80 rounded-full border-dashed" />
          <motion.div 
            className="absolute w-[15vw] h-[15vw] bg-[#00FF7F] rounded-full blur-[4vw]"
            animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      </div>

      <div className="max-w-[45vw] text-right z-10">
        <motion.h2 
          className="text-[#00FF7F] font-display text-[7vw] leading-[0.9] mb-[2vw] uppercase"
          initial={{ opacity: 0, x: 50 }}
          animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: 50 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          Meet Ovia AI
        </motion.h2>
        
        <motion.p 
          className="text-[3vw] font-display text-[#F5F5F5] mb-[4vw] uppercase tracking-wide text-white/80"
          initial={{ opacity: 0, x: 30 }}
          animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
          transition={{ duration: 0.5 }}
        >
          Your personal coach.
        </motion.p>

        <ul className="text-[2.2vw] font-body font-medium text-[#E0E0E0] space-y-[1.5vw] flex flex-col items-end">
          {['Voice coaching', 'Personalized plans', '24/7 motivation'].map((item, i) => (
            <motion.li key={item}
              className="flex items-center gap-[1.5vw]"
              initial={{ opacity: 0, y: 20 }}
              animate={phase >= 2 + i ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              {item}
              <div className="w-[1vw] h-[1vw] bg-[#00FF7F] rounded-full shadow-[0_0_10px_rgba(0,255,127,1)]" />
            </motion.li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}