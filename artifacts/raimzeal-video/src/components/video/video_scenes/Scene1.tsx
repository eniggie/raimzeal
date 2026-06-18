import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1800),
      setTimeout(() => setPhase(3), 3500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const text1 = "STOP SCROLLING.";
  const text2 = "Your best body starts here.";

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center z-20"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
      transition={{ duration: 0.5 }}
    >
      <video
        src={`${import.meta.env.BASE_URL}videos/s1-athlete-run.mp4`}
        autoPlay
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover mix-blend-screen opacity-50"
      />
      <div className="absolute inset-0 bg-black/40" />
      
      <div className="relative text-center px-[5vw] z-10 w-full">
        <h1 className="font-display font-bold leading-[0.9] text-[10vw] uppercase drop-shadow-2xl">
          <div className="mb-[2vw] text-[#F5F5F5]">
            {text1.split('').map((char, i) => (
              <motion.span key={i} style={{ display: 'inline-block' }}
                initial={{ opacity: 0, y: 50, scale: 0.5, rotateX: 90 }}
                animate={phase >= 1 ? { opacity: 1, y: 0, scale: 1, rotateX: 0 } : { opacity: 0, y: 50, scale: 0.5, rotateX: 90 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20, delay: phase >= 1 ? i * 0.05 : 0 }}
                className={char === ' ' ? 'w-[2vw]' : ''}
              >
                {char}
              </motion.span>
            ))}
          </div>
          <div className="text-[#00FF7F] text-[6vw]">
            {text2.split('').map((char, i) => (
              <motion.span key={`t2-${i}`} style={{ display: 'inline-block' }}
                initial={{ opacity: 0, filter: 'blur(10px)', x: -20 }}
                animate={phase >= 2 ? { opacity: 1, filter: 'blur(0px)', x: 0 } : { opacity: 0, filter: 'blur(10px)', x: -20 }}
                transition={{ duration: 0.4, delay: phase >= 2 ? i * 0.03 : 0 }}
                className={char === ' ' ? 'w-[1.5vw]' : ''}
              >
                {char}
              </motion.span>
            ))}
          </div>
        </h1>
      </div>
    </motion.div>
  );
}