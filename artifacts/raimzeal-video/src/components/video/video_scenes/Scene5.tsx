import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 3500), // exit hold
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center z-20"
      initial={{ scale: 1.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div 
        className="absolute w-[40vw] h-[40vw] rounded-full border-[2vw] border-[#00FF7F] mix-blend-screen opacity-50"
        initial={{ rotate: -90, scale: 0 }}
        animate={phase >= 1 ? { rotate: 0, scale: 1 } : { rotate: -90, scale: 0 }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      />
      
      <div className="relative text-center z-10 mix-blend-plus-lighter">
        <motion.h3 
          className="font-display text-[10vw] text-[#F5F5F5] leading-none drop-shadow-2xl"
          initial={{ opacity: 0, y: 40 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          WORKOUTS
        </motion.h3>
        <motion.h3 
          className="font-display text-[10vw] text-[#00FF7F] leading-none drop-shadow-[0_0_15px_rgba(0,255,127,0.5)]"
          initial={{ opacity: 0, y: 40 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          & PROGRESS
        </motion.h3>
      </div>
    </motion.div>
  );
}
