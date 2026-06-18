import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2200),
      setTimeout(() => setPhase(4), 3000), // exit overlap
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-start px-[10vw] z-20"
      initial={{ opacity: 0, x: '20vw' }}
      animate={{ opacity: 1, x: '0vw' }}
      exit={{ opacity: 0, scale: 1.2, x: '-10vw' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="max-w-[60vw]">
        <motion.p 
          className="text-[2.5vw] font-body text-[#9CA3AF] leading-tight mb-[4vw]"
          initial={{ opacity: 0, y: 30 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
        >
          Generic apps lack guidance.<br/>
          You're doing it all alone.
        </motion.p>

        <h2 className="text-[10vw] font-display text-[#F5F5F5] leading-[0.9] uppercase drop-shadow-2xl">
          <motion.div className="overflow-hidden">
            <motion.span 
              className="block text-[#BF00FF]"
              initial={{ y: '100%' }}
              animate={phase >= 2 ? { y: '0%' } : { y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              YOU DESERVE
            </motion.span>
          </motion.div>
          <motion.div className="overflow-hidden">
            <motion.span 
              className="block"
              initial={{ y: '100%' }}
              animate={phase >= 3 ? { y: '0%' } : { y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.1 }}
            >
              BETTER.
            </motion.span>
          </motion.div>
        </h2>
      </div>
    </motion.div>
  );
}
