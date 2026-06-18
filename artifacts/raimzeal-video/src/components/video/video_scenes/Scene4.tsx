import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 1000),
      setTimeout(() => setPhase(3), 1800),
      setTimeout(() => setPhase(4), 2600),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 z-20 flex bg-black"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
      transition={{ duration: 0.6 }}
    >
      <motion.div 
        className="w-1/2 h-full relative overflow-hidden"
      >
        <motion.img 
          src={`${import.meta.env.BASE_URL}images/s4-workout-ai.png`} 
          className="absolute inset-0 w-full h-full object-cover mix-blend-screen opacity-90"
          initial={{ scale: 1.2, filter: 'blur(5px)' }}
          animate={{ scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-transparent" />
      </motion.div>
      
      <div className="absolute left-[5vw] top-[20vh] max-w-[60vw] z-10 flex flex-col justify-center">
        <motion.h3 
          className="font-display text-[8vw] text-[#F5F5F5] leading-[0.9] drop-shadow-2xl uppercase mb-[3vw]"
          initial={{ opacity: 0, x: -40 }}
          animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -40 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        >
          Every workout<br/>
          <span className="text-[#FFB800]">tracked.</span>
        </motion.h3>

        <div className="space-y-[1.5vw] ml-[2vw]">
          {[
            "Outdoor GPS",
            "Rep counting",
            "Strength logging"
          ].map((item, i) => (
            <motion.div key={i}
              className="flex items-center gap-[1.5vw]"
              initial={{ opacity: 0, x: -20 }}
              animate={phase >= 2 + i ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <div className="w-[4vw] h-[4px] bg-[#FFB800]" />
              <h4 className="font-display text-[4vw] text-[#F5F5F5] leading-none uppercase">{item}</h4>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}