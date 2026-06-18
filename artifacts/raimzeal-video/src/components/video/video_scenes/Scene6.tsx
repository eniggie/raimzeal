import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Scene6() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2000),
      setTimeout(() => setPhase(4), 2800),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center z-30"
      initial={{ opacity: 0, backgroundColor: 'rgba(8,12,16,0)' }}
      animate={{ opacity: 1, backgroundColor: 'rgba(8,12,16,1)' }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 0.8 }}
    >
      <motion.div 
        className="text-[14vw] font-display font-bold text-[#F5F5F5] tracking-widest leading-none drop-shadow-[0_0_25px_rgba(0,255,127,0.3)]"
        initial={{ scale: 2, y: 50, opacity: 0 }}
        animate={phase >= 1 ? { scale: 1, y: 0, opacity: 1 } : { scale: 2, y: 50, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 25 }}
      >
        RAIMZEAL
      </motion.div>

      <motion.div className="overflow-hidden mt-[3vw]">
        <motion.div 
          className="bg-[#00FF7F] px-[5vw] py-[1.5vw] rounded-full shadow-[0_0_30px_rgba(0,255,127,0.6)]"
          initial={{ y: '100%' }}
          animate={phase >= 2 ? { y: '0%' } : { y: '100%' }}
          transition={{ type: 'spring', stiffness: 250, damping: 20 }}
        >
          <span className="font-display text-[#080C10] text-[5vw] leading-none block">
            FREE TO START
          </span>
        </motion.div>
      </motion.div>

      <motion.p
        className="font-body text-[#F5F5F5] text-[3vw] mt-[5vw] font-bold tracking-widest drop-shadow-lg"
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6 }}
      >
        raimzeal.com
      </motion.p>
      
      <motion.div
        className="absolute bottom-[8vh] text-[#9CA3AF] font-body text-[1.5vw] tracking-wider uppercase"
        initial={{ opacity: 0 }}
        animate={phase >= 4 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 1 }}
      >
        Available on iOS & Android
      </motion.div>
    </motion.div>
  );
}
