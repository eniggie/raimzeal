import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 100),
      setTimeout(() => setPhase(2), 500),
      setTimeout(() => setPhase(3), 1200),
      setTimeout(() => setPhase(4), 3000), // Exit phase
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center z-20"
      initial={{ scale: 1.1, filter: 'blur(20px)', opacity: 0 }}
      animate={{ scale: 1, filter: 'blur(0px)', opacity: 1 }}
      exit={{ scale: 0.9, filter: 'blur(10px)', opacity: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.img 
        src={`${import.meta.env.BASE_URL}images/transformation.png`}
        className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-screen"
        initial={{ scale: 1.2, rotate: -2 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ duration: 4, ease: 'easeOut' }}
      />
      
      <div className="relative text-center px-[5vw]">
        <motion.div
          className="text-[#00FF7F] font-body font-bold tracking-[0.4em] uppercase text-[1.5vw] mb-4 shadow-black drop-shadow-md"
          initial={{ y: -20, opacity: 0 }}
          animate={phase >= 1 ? { y: 0, opacity: 1 } : { y: -20, opacity: 0 }}
          transition={{ duration: 0.6 }}
        >
          Your Journey
        </motion.div>

        <h1 className="font-display font-bold text-[#F5F5F5] leading-[0.85] text-[12vw] uppercase flex flex-col items-center drop-shadow-2xl">
          <motion.div className="overflow-hidden">
            <motion.span 
              className="block"
              initial={{ y: '100%', rotateZ: 5 }}
              animate={phase >= 2 ? { y: '0%', rotateZ: 0 } : { y: '100%', rotateZ: 5 }}
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            >
              TRANSFORMATION
            </motion.span>
          </motion.div>
          
          <motion.div className="overflow-hidden bg-[#00FF7F] px-[2vw] mt-[1vw]">
            <motion.span 
              className="block text-[#080C10]"
              initial={{ x: '-100%' }}
              animate={phase >= 3 ? { x: '0%' } : { x: '-100%' }}
              transition={{ type: 'spring', stiffness: 250, damping: 20 }}
            >
              STARTS NOW
            </motion.span>
          </motion.div>
        </h1>
      </div>
    </motion.div>
  );
}
