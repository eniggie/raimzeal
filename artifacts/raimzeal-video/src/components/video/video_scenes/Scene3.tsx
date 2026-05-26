import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1000),
      setTimeout(() => setPhase(3), 1800),
      setTimeout(() => setPhase(4), 2600),
      setTimeout(() => setPhase(5), 4000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-end px-[10vw] z-10"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="absolute left-[10vw] top-[20vh] w-[35vw] h-[35vw]">
         <motion.div 
            className="w-full h-full border border-[#2E8B57]/30 rounded-full flex items-center justify-center relative"
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
         >
            <motion.div className="w-[80%] h-[80%] border border-[#2E8B57]/50 rounded-full border-dashed" />
            
            <motion.div 
              className="absolute w-[5vw] h-[5vw] bg-[#2E8B57] rounded-full blur-[2vw]"
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
         </motion.div>
      </div>

      <div className="max-w-[45vw] text-right">
        <motion.div
          className="text-[#2E8B57] font-display text-[10vw] leading-none mb-2"
          initial={{ opacity: 0, x: -50 }}
          animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -50 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          OVIA AI
        </motion.div>
        
        <motion.p 
          className="text-[2vw] font-body text-[#F5F0E8] mb-8 font-medium"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.5 }}
        >
          Your personal fitness & wellness coach.
        </motion.p>

        <ul className="text-[1.5vw] font-body text-[#F5F0E8]/70 space-y-4">
          <motion.li 
            initial={{ opacity: 0, x: 20 }}
            animate={phase >= 3 ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="flex items-center justify-end gap-3"
          >
            Smart voice transcription
            <div className="w-[1vw] h-[1vw] bg-[#2E8B57] rounded-full" />
          </motion.li>
          <motion.li 
            initial={{ opacity: 0, x: 20 }}
            animate={phase >= 4 ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="flex items-center justify-end gap-3"
          >
            Personalized plans
            <div className="w-[1vw] h-[1vw] bg-[#2E8B57] rounded-full" />
          </motion.li>
          <motion.li 
            initial={{ opacity: 0, x: 20 }}
            animate={phase >= 5 ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="flex items-center justify-end gap-3"
          >
            Always there to motivate
            <div className="w-[1vw] h-[1vw] bg-[#2E8B57] rounded-full" />
          </motion.li>
        </ul>
      </div>
    </motion.div>
  );
}
