import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';
import { Scene6 } from './video_scenes/Scene6';

export const SCENE_DURATIONS = {
  hook: 4000,
  problem: 4000,
  solutionAI: 6000,
  solutionPlatform: 6000,
  solutionProgress: 5000,
  cta: 5000,
};

const SCENE_COMPONENTS: Record<string, React.ComponentType> = {
  hook: Scene1,
  problem: Scene2,
  solutionAI: Scene3,
  solutionPlatform: Scene4,
  solutionProgress: Scene5,
  cta: Scene6,
};

const SCENE_START_SEC: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  let cumulativeMs = 0;
  for (const [key, ms] of Object.entries(SCENE_DURATIONS)) {
    out[key] = cumulativeMs / 1000;
    cumulativeMs += ms;
  }
  return out;
})();

const AUDIO_SEEK_EPSILON_SEC = 0.18;

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  muted = false,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  muted?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentScene, currentSceneKey } = useVideoPlayer({ durations, loop });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '');
  const sceneIndex = Object.keys(SCENE_DURATIONS).indexOf(baseSceneKey as keyof typeof SCENE_DURATIONS);
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.45;
    const targetTime = SCENE_START_SEC[baseSceneKey] ?? 0;
    if (Math.abs(audio.currentTime - targetTime) > AUDIO_SEEK_EPSILON_SEC) {
      audio.currentTime = targetTime;
    }
    audio.play().catch(() => {});
  }, [currentSceneKey, baseSceneKey, muted]);

  return (
    <>
      <div className="relative w-full h-screen overflow-hidden bg-[#080C10]">
        
        {/* Persistent Video Background */}
        <div className="absolute inset-0 opacity-20 mix-blend-screen pointer-events-none">
          <video
            src={`${import.meta.env.BASE_URL}videos/fitness-bg.mp4`}
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
          />
        </div>

        {/* Dynamic Color Overlay depending on Scene */}
        <motion.div
          className="absolute inset-0 z-0 pointer-events-none"
          animate={{
            backgroundColor: [
              'rgba(8, 12, 16, 0.8)',   // hook
              'rgba(191, 0, 255, 0.15)', // problem
              'rgba(0, 255, 127, 0.15)', // solutionAI
              'rgba(255, 184, 0, 0.15)', // solutionPlatform
              'rgba(8, 12, 16, 0.7)',   // solutionProgress
              'rgba(0, 255, 127, 0.2)'  // cta
            ][sceneIndex] || 'rgba(8, 12, 16, 0.8)'
          }}
          transition={{ duration: 1.5, ease: 'easeInOut' }}
        />

        {/* Persistent Floating Particles/Shapes */}
        <motion.div
          className="absolute w-[60vw] h-[60vw] rounded-full mix-blend-screen opacity-10 blur-[8vw] pointer-events-none"
          style={{ background: 'radial-gradient(circle, #00FF7F, transparent)' }}
          animate={{
            x: ['-20vw', '50vw', '10vw', '80vw', '-10vw', '30vw'][sceneIndex] || '0vw',
            y: ['-20vh', '10vh', '60vh', '20vh', '80vh', '50vh'][sceneIndex] || '0vh',
            scale: [1, 1.2, 0.8, 1.5, 1, 1.3][sceneIndex] || 1
          }}
          transition={{ duration: 2, ease: [0.25, 1, 0.5, 1] }}
        />
        
        <motion.div
          className="absolute w-[50vw] h-[50vw] rounded-full mix-blend-screen opacity-10 blur-[6vw] pointer-events-none"
          style={{ background: 'radial-gradient(circle, #BF00FF, transparent)' }}
          animate={{
            x: ['80vw', '10vw', '50vw', '-10vw', '60vw', '20vw'][sceneIndex] || '0vw',
            y: ['60vh', '80vh', '10vh', '50vh', '-20vh', '30vh'][sceneIndex] || '0vh',
          }}
          transition={{ duration: 2.5, ease: [0.25, 1, 0.5, 1] }}
        />

        {/* Persistent Accent Line */}
        <motion.div
          className="absolute h-[2px] bg-[#00FF7F] z-10 pointer-events-none shadow-[0_0_15px_rgba(0,255,127,0.8)]"
          animate={{
            left: ['0%', '10%', '60%', '20%', '15%', '0%'][sceneIndex] || '0%',
            top: ['50%', '80%', '20%', '90%', '10%', '50%'][sceneIndex] || '50%',
            width: ['0%', '80%', '30%', '60%', '40%', '100%'][sceneIndex] || '0%',
            opacity: [0, 0.6, 0.8, 0.5, 0.7, 0][sceneIndex] || 0,
          }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        />

        {/* Scene rendering */}
        <AnimatePresence mode="popLayout">
          {SceneComponent && <SceneComponent key={currentSceneKey} />}
        </AnimatePresence>

      </div>

      <audio
        ref={audioRef}
        src={`${import.meta.env.BASE_URL}audio/bg_music.mp3`}
        preload="auto"
        autoPlay
        muted={muted}
        loop
      />
    </>
  );
}
