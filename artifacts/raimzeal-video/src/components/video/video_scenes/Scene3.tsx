import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2200),
      setTimeout(() => setPhase(4), 3200),
      setTimeout(() => setPhase(5), 4500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-end px-[10vw] z-20"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, x: '20vw', filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="absolute left-[10vw] top-[50%] -translate-y-1/2 w-[35vw] h-[35vw]">
        <motion.div 
          className="w-full h-full rounded-full border border-[#00FF7F]/30 flex items-center justify-center relative shadow-[0_0_40px_rgba(0,255,127,0.2)]"
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        >
          <motion.div className="w-[80%] h-[80%] border border-[#00FF7F]/50 rounded-full border-dashed" />
          <motion.div 
            className="absolute w-[8vw] h-[8vw] bg-[#00FF7F] rounded-full blur-[2vw]"
            animate={{ scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      </div>

      <div className="max-w-[45vw] text-right z-10 relative">
        <motion.div
          className="text-[#00FF7F] font-display text-[12vw] leading-[0.8] mb-[2vw] drop-shadow-2xl"
          initial={{ opacity: 0, x: -50 }}
          animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -50 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          OVIA AI
        </motion.div>
        
        <motion.p 
          className="text-[2vw] font-body text-[#E0E0E0] mb-[4vw] font-medium drop-shadow-md"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.5 }}
        >
          Your smart fitness & wellness coach.
        </motion.p>

        <ul className="text-[1.8vw] font-body text-[#F5F5F5]/90 space-y-[2vw]">
          <motion.li 
            initial={{ opacity: 0, x: 20 }}
            animate={phase >= 3 ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="flex items-center justify-end gap-[1vw] drop-shadow-lg"
          >
            Voice transcription
            <div className="w-[1.2vw] h-[1.2vw] bg-[#00FF7F] rounded-full shadow-[0_0_10px_rgba(0,255,127,0.8)]" />
          </motion.li>
          <motion.li 
            initial={{ opacity: 0, x: 20 }}
            animate={phase >= 4 ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="flex items-center justify-end gap-[1vw] drop-shadow-lg"
          >
            Personalized action plans
            <div className="w-[1.2vw] h-[1.2vw] bg-[#00FF7F] rounded-full shadow-[0_0_10px_rgba(0,255,127,0.8)]" />
          </motion.li>
        </ul>
      </div>
    </motion.div>
  );
}
