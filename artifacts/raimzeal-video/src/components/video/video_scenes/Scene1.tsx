import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 100),
      setTimeout(() => setPhase(2), 600),
      setTimeout(() => setPhase(3), 1200),
      setTimeout(() => setPhase(4), 2200), // Exit drift
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center z-10"
      initial={{ scale: 1.2, filter: 'blur(20px)', opacity: 0 }}
      animate={{ scale: 1, filter: 'blur(0px)', opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0, filter: 'blur(10px)' }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      
      {/* Transformation visual overlay */}
      <motion.img 
        src={`${import.meta.env.BASE_URL}images/transformation.png`}
        className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-screen mix-blend-color-dodge"
        initial={{ rotate: -5, scale: 1.1 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ duration: 3, ease: 'easeOut' }}
      />

      <div className="relative text-center">
        <motion.div
          className="text-[#FF6B35] font-body font-bold tracking-[0.3em] uppercase text-[1.5vw] mb-4"
          initial={{ y: 20, opacity: 0 }}
          animate={phase >= 1 ? { y: 0, opacity: 1 } : { y: 20, opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          Stop scrolling.
        </motion.div>

        <h1 className="font-display font-bold text-[#F5F0E8] leading-[0.8] text-[12vw] uppercase flex flex-col items-center">
          <motion.div className="overflow-hidden">
            <motion.span 
              className="block"
              initial={{ y: '100%', rotateZ: 10 }}
              animate={phase >= 2 ? { y: '0%', rotateZ: 0 } : { y: '100%', rotateZ: 10 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              YOUR
            </motion.span>
          </motion.div>
          
          <motion.div className="overflow-hidden bg-[#2E8B57] px-[2vw]">
            <motion.span 
              className="block text-[#0D1117]"
              initial={{ x: '-100%' }}
              animate={phase >= 3 ? { x: '0%' } : { x: '-100%' }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            >
              TRANSFORMATION
            </motion.span>
          </motion.div>
          
          <motion.div className="overflow-hidden">
            <motion.span 
              className="block"
              initial={{ y: '-100%', opacity: 0 }}
              animate={phase >= 3 ? { y: '0%', opacity: 1 } : { y: '-100%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 250, damping: 25, delay: 0.1 }}
            >
              STARTS NOW
            </motion.span>
          </motion.div>
        </h1>
      </div>

    </motion.div>
  );
}
