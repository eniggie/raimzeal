import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2800),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-start px-[8vw] z-20 bg-black/60"
      initial={{ opacity: 0, x: '10vw' }}
      animate={{ opacity: 1, x: '0vw' }}
      exit={{ opacity: 0, x: '-10vw' }}
      transition={{ duration: 0.6 }}
    >
      <motion.img 
        src={`${import.meta.env.BASE_URL}images/s2-problem.png`}
        className="absolute inset-0 w-[50vw] left-[50vw] h-full object-cover opacity-20 mix-blend-screen"
        initial={{ scale: 1.2, x: '10vw' }}
        animate={{ scale: 1, x: '0vw' }}
        transition={{ duration: 4, ease: 'easeOut' }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#080C10] via-[#080C10]/80 to-transparent" />
      
      <div className="max-w-[55vw] relative z-10 flex flex-col gap-[3vw]">
        <motion.p 
          className="text-[4.5vw] font-display text-[#EF4444] leading-[1] uppercase tracking-wide"
          initial={{ opacity: 0, y: 30 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          Expensive apps.<br/>No real guidance.
        </motion.p>

        <motion.h2 
          className="text-[6vw] font-display text-[#F5F5F5] leading-[0.9] uppercase"
          initial={{ opacity: 0, scale: 0.9, filter: 'blur(5px)' }}
          animate={phase >= 2 ? { opacity: 1, scale: 1, filter: 'blur(0px)' } : { opacity: 0, scale: 0.9, filter: 'blur(5px)' }}
          transition={{ duration: 0.5 }}
        >
          You deserve better<br/>than generic.
        </motion.h2>
      </div>
    </motion.div>
  );
}