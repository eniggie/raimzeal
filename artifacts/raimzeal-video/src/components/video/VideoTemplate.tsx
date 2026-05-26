import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';

export const SCENE_DURATIONS = {
  hook: 3000,
  problem: 4000,
  solutionAI: 5000,
  solutionPlatform: 5000,
  cta: 5000,
};

const SCENE_COMPONENTS: Record<string, React.ComponentType> = {
  hook: Scene1,
  problem: Scene2,
  solutionAI: Scene3,
  solutionPlatform: Scene4,
  cta: Scene5,
};

const bgColors = [
  '#0D1117',
  '#0A0D12',
  '#111620',
  '#0F151E',
  '#2E8B57',
];

const accentPath = [
  { x: '-10vw', y: '110vh', scale: 0.5, rotate: 0, opacity: 0 },
  { x: '80vw', y: '80vh', scale: 1.5, rotate: 45, opacity: 0.3 },
  { x: '10vw', y: '20vh', scale: 2, rotate: 90, opacity: 0.5 },
  { x: '50vw', y: '50vh', scale: 1, rotate: 180, opacity: 0.8 },
  { x: '50vw', y: '50vh', scale: 20, rotate: 360, opacity: 1 },
];

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
      <div className="relative w-full h-screen overflow-hidden bg-[#0D1117]">

        <div className="absolute inset-0 opacity-20 mix-blend-screen">
          <video
            src={`${import.meta.env.BASE_URL}videos/fitness-bg.mp4`}
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
          />
        </div>

        <motion.div
          className="absolute inset-0 z-0"
          animate={{ backgroundColor: bgColors[sceneIndex] }}
          transition={{ duration: 1.5, ease: 'easeInOut' }}
        />

        <motion.div
          className="absolute w-[40vw] h-[40vw] rounded-full border-[8vw] border-[#2E8B57] z-0 blur-[2px] mix-blend-screen"
          animate={accentPath[sceneIndex]}
          transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
        />

        <motion.div
          className="absolute w-[2px] bg-[#FF6B35] z-0"
          animate={{
            left: ['0%', '20%', '80%', '40%', '50%'][sceneIndex],
            top: '0%',
            height: ['0%', '100%', '100%', '100%', '0%'][sceneIndex],
            opacity: [0, 0.6, 0.8, 0.4, 0][sceneIndex],
          }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
        />

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
      />
    </>
  );
}
