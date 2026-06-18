import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2000),
      setTimeout(() => setPhase(4), 2800),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-between px-[8vw] z-20 bg-black/50"
      initial={{ opacity: 0, x: '-10vw' }}
      animate={{ opacity: 1, x: '0vw' }}
      exit={{ opacity: 0, x: '10vw' }}
      transition={{ duration: 0.6 }}
    >
      <div className="absolute inset-0 opacity-20 mix-blend-screen pointer-events-none">
        <motion.img 
          src={`${import.meta.env.BASE_URL}images/food-therapy.png`}
          className="w-full h-full object-cover"
          animate={{ scale: [1.1, 1.05] }}
          transition={{ duration: 5, ease: 'linear' }}
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-[#080C10]/90 to-transparent" />
      
      <div className="max-w-[45vw] relative z-10">
        <motion.h2 
          className="font-display text-[7.5vw] text-[#F5F5F5] leading-[0.9] mb-[4vw] drop-shadow-2xl uppercase"
          initial={{ opacity: 0, y: 30 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ type: 'spring', stiffness: 250, damping: 20 }}
        >
          Know exactly<br/><span className="text-[#00FF7F]">what you eat.</span>
        </motion.h2>

        <div className="space-y-[2vw]">
          {[
            "Barcode scanner",
            "Macro tracking",
            "1M+ foods database"
          ].map((item, i) => (
            <motion.div key={i}
              className="bg-[#11151A]/60 border border-[#00FF7F]/40 backdrop-blur-md px-[2.5vw] py-[1.5vw] rounded-xl"
              initial={{ opacity: 0, scale: 0.9, x: -30 }}
              animate={phase >= 2 + i ? { opacity: 1, scale: 1, x: 0 } : { opacity: 0, scale: 0.9, x: -30 }}
              transition={{ type: 'spring', stiffness: 250, damping: 20 }}
            >
              <span className="font-display text-[#E0E0E0] text-[3vw] uppercase">{item}</span>
            </motion.div>
          ))}
        </div>
      </div>
      
      <motion.div 
        className="w-[35vw] relative z-10"
        initial={{ opacity: 0, rotateY: -30, x: 50 }}
        animate={phase >= 1 ? { opacity: 1, rotateY: 0, x: 0 } : { opacity: 0, rotateY: -30, x: 50 }}
        transition={{ type: 'spring', stiffness: 200, damping: 25 }}
      >
        <img src={`${import.meta.env.BASE_URL}images/s5-barcode-scan.png`} className="w-full h-auto drop-shadow-2xl" />
        
        {/* Animated scanning bar */}
        {phase >= 3 && (
          <motion.div 
            className="absolute left-[10%] right-[10%] h-[4px] bg-[#00FF7F] shadow-[0_0_15px_#00FF7F]"
            initial={{ top: '20%' }}
            animate={{ top: ['20%', '80%', '20%'] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          />
        )}
      </motion.div>
    </motion.div>
  );
}