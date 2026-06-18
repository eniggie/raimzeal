import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Scene8() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1200),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-start px-[10vw] z-20"
      initial={{ opacity: 0, x: '20vw' }}
      animate={{ opacity: 1, x: '0vw' }}
      exit={{ opacity: 0, x: '-20vw' }}
      transition={{ duration: 0.8 }}
    >
      <motion.img 
        src={`${import.meta.env.BASE_URL}images/community.png`}
        className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-screen"
        initial={{ x: '5vw' }}
        animate={{ x: '0vw' }}
        transition={{ duration: 4, ease: 'easeOut' }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#080C10] via-[#080C10]/80 to-transparent" />
      
      <div className="max-w-[45vw] relative z-10">
        <motion.h2 
          className="text-[#BF00FF] font-display text-[10vw] leading-[0.8] mb-[2vw] drop-shadow-2xl uppercase"
          initial={{ opacity: 0, x: -40 }}
          animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -40 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          You're not<br/>alone.
        </motion.h2>
        
        <div className="space-y-[1.5vw]">
          {['Challenges', 'Leaderboards', 'Peer support'].map((text, i) => (
            <motion.div key={text}
              className="text-[#F5F5F5] font-body text-[2.5vw] font-medium drop-shadow-lg flex items-center gap-[1vw]"
              initial={{ opacity: 0, x: -20 }}
              animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
              transition={{ delay: i * 0.15, type: 'spring', stiffness: 250, damping: 20 }}
            >
              <div className="w-[1vw] h-[1vw] bg-[#BF00FF] rounded-full" />
              {text}
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}