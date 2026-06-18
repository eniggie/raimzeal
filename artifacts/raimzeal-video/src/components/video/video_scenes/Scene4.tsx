import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 4500), // exit
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center z-20"
      initial={{ opacity: 0, filter: 'blur(20px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: '-10vh' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-full h-full flex">
        {/* Panel 1: Food Therapy */}
        <motion.div 
          className="w-1/2 h-full bg-[#080C10] relative overflow-hidden"
          initial={{ y: '100%' }}
          animate={phase >= 1 ? { y: '0%' } : { y: '100%' }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        >
          <img src={`${import.meta.env.BASE_URL}images/food-therapy.png`} className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-screen" />
          <div className="absolute bottom-[15vh] left-[5vw]">
            <motion.div 
              className="text-[#FFB800] text-[2vw] font-body tracking-[0.2em] uppercase font-bold mb-[1vw]"
              initial={{ opacity: 0, y: 20 }}
              animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              Nutrition
            </motion.div>
            <motion.h3 
              className="font-display text-[6vw] text-[#F5F5F5] leading-[0.8] drop-shadow-2xl"
              initial={{ opacity: 0, x: -30 }}
              animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
              transition={{ type: 'spring', stiffness: 250, damping: 20, delay: 0.3 }}
            >
              FOOD<br/>THERAPY
            </motion.h3>
          </div>
        </motion.div>
        
        {/* Panel 2: Community */}
        <motion.div 
          className="w-1/2 h-full bg-[#080C10] relative overflow-hidden"
          initial={{ y: '-100%' }}
          animate={phase >= 1 ? { y: '0%' } : { y: '-100%' }}
          transition={{ type: 'spring', stiffness: 200, damping: 25, delay: 0.1 }}
        >
          <img src={`${import.meta.env.BASE_URL}images/community.png`} className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-screen" />
          <div className="absolute top-[15vh] right-[5vw] text-right">
            <motion.div 
              className="text-[#BF00FF] text-[2vw] font-body tracking-[0.2em] uppercase font-bold mb-[1vw]"
              initial={{ opacity: 0, y: -20 }}
              animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              Motivation
            </motion.div>
            <motion.h3 
              className="font-display text-[6vw] text-[#F5F5F5] leading-[0.8] drop-shadow-2xl"
              initial={{ opacity: 0, x: 30 }}
              animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
              transition={{ type: 'spring', stiffness: 250, damping: 20, delay: 0.5 }}
            >
              COMMUNITY<br/>SUPPORT
            </motion.h3>
          </div>
        </motion.div>
      </div>
      
      {/* Center Dividing Line */}
      <motion.div 
        className="absolute top-0 bottom-0 w-[4px] bg-[#00FF7F] z-30 shadow-[0_0_20px_rgba(0,255,127,1)]"
        initial={{ scaleY: 0 }}
        animate={phase >= 2 ? { scaleY: 1 } : { scaleY: 0 }}
        transition={{ duration: 0.8, ease: 'easeInOut' }}
      />
    </motion.div>
  );
}
