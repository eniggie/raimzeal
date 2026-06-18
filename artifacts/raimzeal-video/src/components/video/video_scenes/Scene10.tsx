import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Scene10() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const title = "RAIMZEAL";

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center z-30 bg-[#080C10]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
      transition={{ duration: 0.8 }}
    >
      <div className="relative text-center px-[5vw]">
        <h1 className="text-[18vw] font-display font-bold text-[#F5F5F5] tracking-widest leading-none drop-shadow-[0_0_30px_rgba(0,255,127,0.4)]">
          {title.split('').map((char, i) => (
            <motion.span key={i} style={{ display: 'inline-block' }}
              initial={{ opacity: 0, y: 100, scale: 0.5 }}
              animate={phase >= 1 ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 100, scale: 0.5 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15, delay: phase >= 1 ? i * 0.05 : 0 }}
            >
              {char}
            </motion.span>
          ))}
        </h1>

        <motion.div className="overflow-hidden mt-[2vw]">
          <motion.div 
            className="bg-[#00FF7F] px-[5vw] py-[1.5vw] rounded-full inline-block shadow-[0_0_20px_rgba(0,255,127,0.6)]"
            initial={{ y: '100%' }}
            animate={phase >= 2 ? { y: '0%' } : { y: '100%' }}
            transition={{ type: 'spring', stiffness: 250, damping: 20 }}
          >
            <span className="font-display text-[#080C10] text-[5vw] leading-none block">
              DOWNLOAD FREE.
            </span>
          </motion.div>
        </motion.div>

        <motion.div
          className="mt-[5vw] flex flex-col items-center gap-[2vw]"
          initial={{ opacity: 0 }}
          animate={phase >= 3 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.8 }}
        >
          <p className="font-body text-[#F5F5F5] text-[3.5vw] font-bold tracking-widest drop-shadow-lg">
            raimzeal.com
          </p>
          <p className="text-[#9CA3AF] font-body text-[2vw] tracking-wider uppercase border border-white/20 px-[3vw] py-[1vw] rounded-full">
            iOS & Android
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}