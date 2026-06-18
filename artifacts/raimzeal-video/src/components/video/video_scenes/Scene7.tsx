import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Scene7() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2200),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center z-20"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, y: '20vh' }}
      transition={{ duration: 0.8 }}
    >
      <motion.img 
        src={`${import.meta.env.BASE_URL}images/transformation.png`}
        className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-screen"
        initial={{ scale: 1 }}
        animate={{ scale: 1.1 }}
        transition={{ duration: 5, ease: 'linear' }}
      />
      
      <div className="absolute inset-0 bg-[#080C10]/60" />

      <div className="relative text-center max-w-[80vw]">
        <motion.h2 
          className="text-[9vw] font-display text-[#F5F5F5] leading-[0.9] uppercase drop-shadow-2xl mb-[2vw]"
          initial={{ opacity: 0, y: 50 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          TRACK YOUR BODY.
        </motion.h2>

        <motion.p 
          className="text-[4vw] font-display text-[#00FF7F] mb-[4vw]"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={phase >= 2 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.6 }}
        >
          CELEBRATE EVERY WIN.
        </motion.p>

        <div className="flex justify-center gap-[2vw]">
          {[
            { val: "12", label: "Streak" },
            { val: "24", label: "Workouts" },
            { val: "3", label: "Badges" }
          ].map((stat, i) => (
            <motion.div key={i}
              className="bg-[#11151A]/90 border border-white/10 px-[3vw] py-[2vw] rounded-2xl min-w-[15vw]"
              initial={{ opacity: 0, y: 30 }}
              animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
              transition={{ delay: i * 0.15, type: 'spring', stiffness: 300, damping: 25 }}
            >
              <div className="font-display text-[5vw] text-[#F5F5F5] leading-none mb-[0.5vw]">{stat.val}</div>
              <div className="font-body text-[1.2vw] text-[#9CA3AF] uppercase tracking-wider">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}