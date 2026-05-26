import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 100),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2400),
      setTimeout(() => setPhase(4), 3600),
      setTimeout(() => setPhase(5), 4200),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center z-10"
      initial={{ opacity: 0, y: '50vh' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 1.5, filter: 'blur(20px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      
      <div className="absolute inset-0 flex">
        {/* Panel 1 */}
        <motion.div 
          className="w-1/2 h-full bg-[#0D1117] overflow-hidden relative border-r border-[#2E8B57]/20"
          initial={{ width: '0%' }}
          animate={phase >= 1 ? { width: '50%' } : { width: '0%' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <img src={`${import.meta.env.BASE_URL}images/food-therapy.png`} className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-screen" />
          <div className="absolute bottom-[10vh] left-[5vw]">
             <h3 className="font-display text-[5vw] text-[#F5F0E8] leading-none">FOOD THERAPY</h3>
             <p className="font-body text-[1.5vw] text-[#2E8B57]">Evidence-based nutrition</p>
          </div>
        </motion.div>
        
        {/* Panel 2 */}
        <motion.div 
          className="w-1/2 h-full bg-[#0D1117] overflow-hidden relative"
          initial={{ width: '0%' }}
          animate={phase >= 2 ? { width: '50%' } : { width: '0%' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
           <img src={`${import.meta.env.BASE_URL}images/community.png`} className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-screen" />
           <div className="absolute top-[10vh] right-[5vw] text-right">
             <h3 className="font-display text-[5vw] text-[#F5F0E8] leading-none">COMMUNITY</h3>
             <p className="font-body text-[1.5vw] text-[#FF6B35]">Challenges & peer motivation</p>
          </div>
        </motion.div>
      </div>

      {/* Center Overlay */}
      <motion.div 
        className="absolute w-[30vw] h-[30vw] bg-[#2E8B57] rounded-full flex flex-col items-center justify-center mix-blend-screen"
        initial={{ scale: 0, opacity: 0 }}
        animate={phase >= 3 ? { scale: 1, opacity: 0.9 } : { scale: 0, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        <span className="font-display text-[#0D1117] text-[4vw] leading-tight">WORKOUTS</span>
        <span className="font-display text-[#0D1117] text-[4vw] leading-tight">& PROGRESS</span>
      </motion.div>

    </motion.div>
  );
}
