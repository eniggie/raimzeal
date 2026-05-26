import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2000),
      setTimeout(() => setPhase(4), 2500),
      setTimeout(() => setPhase(5), 4000), // Hold before exit
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center z-20"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div 
        className="text-[12vw] font-display font-bold text-[#F5F0E8] tracking-widest leading-none drop-shadow-2xl"
        initial={{ scale: 2, y: 50, opacity: 0 }}
        animate={phase >= 1 ? { scale: 1, y: 0, opacity: 1 } : { scale: 2, y: 50, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 150, damping: 15 }}
      >
        RAIMZEAL
      </motion.div>

      <motion.div
        className="overflow-hidden mt-[2vw]"
      >
        <motion.div 
          className="bg-[#FF6B35] px-[4vw] py-[1vw] rounded-full"
          initial={{ y: '100%' }}
          animate={phase >= 2 ? { y: '0%' } : { y: '100%' }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          <span className="font-display text-[#0D1117] text-[4vw] leading-none block">
            FREE TO START
          </span>
        </motion.div>
      </motion.div>

      <motion.p
        className="font-body text-[#F5F0E8] text-[2.5vw] mt-[4vw] font-bold"
        initial={{ opacity: 0 }}
        animate={phase >= 3 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.5 }}
      >
        raimzeal.com
      </motion.p>
      
      <motion.div
        className="absolute bottom-[5vh] text-[#F5F0E8]/50 font-body text-[1vw]"
        initial={{ opacity: 0 }}
        animate={phase >= 4 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 1 }}
      >
        Available on iOS & Android
      </motion.div>

    </motion.div>
  );
}
