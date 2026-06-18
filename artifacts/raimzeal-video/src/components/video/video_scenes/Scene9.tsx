import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Scene9() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const text1 = "100% free. No subscription.";
  const text2 = "No catch.";

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center z-20 text-center bg-black/80"
      initial={{ opacity: 0, filter: 'blur(20px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 0.8 }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#00FF7F]/20 via-transparent to-transparent pointer-events-none" />
      
      <div className="relative z-10 px-[10vw]">
        
        <motion.h2 
          className="font-display text-[8vw] text-[#F5F5F5] leading-none mb-[2vw] drop-shadow-2xl"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={phase >= 1 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
          transition={{ type: 'spring', stiffness: 250, damping: 20 }}
        >
          {text1}
        </motion.h2>

        <motion.h3 
          className="font-display text-[7vw] text-[#F5F5F5] leading-none mb-[2vw] drop-shadow-2xl"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={phase >= 2 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
          transition={{ type: 'spring', stiffness: 250, damping: 20 }}
        >
          {text2}
        </motion.h3>
        
        <div className="mt-[4vw]">
          <h1 className="text-[20vw] font-display font-bold text-[#00FF7F] leading-none drop-shadow-[0_0_30px_rgba(0,255,127,0.5)]">
            {['$', '0'].map((char, i) => (
              <motion.span key={i} style={{ display: 'inline-block' }}
                initial={{ opacity: 0, y: 100, scale: 0.5 }}
                animate={phase >= 3 ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 100, scale: 0.5 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20, delay: phase >= 3 ? i * 0.1 : 0 }}
              >
                {char}
              </motion.span>
            ))}
          </h1>
        </div>
      </div>
    </motion.div>
  );
}