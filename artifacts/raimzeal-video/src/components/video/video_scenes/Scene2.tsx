import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2000),
      setTimeout(() => setPhase(4), 3200), // Exit drift
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-start px-[10vw] z-10"
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: '0%', opacity: 1 }}
      exit={{ x: '-50%', opacity: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="max-w-[50vw]">
        <motion.p 
          className="text-[2.5vw] font-body text-[#F5F0E8]/70 leading-tight mb-8"
          initial={{ opacity: 0, x: 30 }}
          animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
          transition={{ duration: 0.5 }}
        >
          Generic apps. No guidance.<br/>Going it alone.
        </motion.p>

        <motion.h2 
          className="text-[8vw] font-display text-[#F5F0E8] leading-none uppercase"
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={phase >= 2 ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 50, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          YOU DESERVE<br/>
          <span className="text-[#FF6B35]">BETTER.</span>
        </motion.h2>

        <motion.div 
          className="h-[1vw] bg-[#FF6B35] mt-[2vw]"
          initial={{ width: 0 }}
          animate={phase >= 3 ? { width: '100%' } : { width: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>

    </motion.div>
  );
}
