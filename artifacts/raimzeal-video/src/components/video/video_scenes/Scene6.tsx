import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Scene6() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 1200),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center px-[5vw] z-20 text-center bg-black/70"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
      transition={{ duration: 0.6 }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#FFB800]/20 via-transparent to-transparent pointer-events-none" />

      <motion.h2 
        className="text-[8vw] font-display text-[#FFB800] leading-[0.9] uppercase drop-shadow-2xl mb-[3vw]"
        initial={{ opacity: 0, y: 50 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        Evidence-based<br/><span className="text-[#F5F5F5]">food therapy.</span>
      </motion.h2>
      
      <motion.div 
        className="relative"
        initial={{ opacity: 0, width: 0 }}
        animate={phase >= 2 ? { opacity: 1, width: '60vw' } : { opacity: 0, width: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <div className="h-[2px] bg-[#FFB800] w-full mb-[3vw]" />
      </motion.div>

      <motion.p 
        className="text-[3.5vw] font-display text-[#9CA3AF] uppercase tracking-wide"
        initial={{ opacity: 0, filter: 'blur(10px)' }}
        animate={phase >= 2 ? { opacity: 1, filter: 'blur(0px)' } : { opacity: 0, filter: 'blur(10px)' }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        Not just calories.<br/>Healing through food.
      </motion.p>
    </motion.div>
  );
}