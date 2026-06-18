import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';
import { Scene6 } from './video_scenes/Scene6';
import { Scene7 } from './video_scenes/Scene7';
import { Scene8 } from './video_scenes/Scene8';
import { Scene9 } from './video_scenes/Scene9';
import { Scene10 } from './video_scenes/Scene10';

export const SCENE_DURATIONS = {
  s1_hook: 4500,
  s2_problem: 4000,
  s3_ovia: 5000,
  s4_workouts: 4500,
  s5_food: 5000,
  s6_macros: 4000,
  s7_progress: 5000,
  s8_community: 4000,
  s9_health: 4500,
  s10_cta: 5000,
};

const SCENE_COMPONENTS: Record<string, React.ComponentType> = {
  s1_hook: Scene1,
  s2_problem: Scene2,
  s3_ovia: Scene3,
  s4_workouts: Scene4,
  s5_food: Scene5,
  s6_macros: Scene6,
  s7_progress: Scene7,
  s8_community: Scene8,
  s9_health: Scene9,
  s10_cta: Scene10,
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
        
        {/* Persistent background gradient that shifts hue per scene (green -> amber -> purple -> green) */}
        <motion.div
          className="absolute inset-0 z-0 pointer-events-none"
          animate={{
            backgroundColor: [
              'rgba(0, 255, 127, 0.15)',  // s1 green
              'rgba(255, 184, 0, 0.15)',  // s2 amber
              'rgba(191, 0, 255, 0.15)',  // s3 purple
              'rgba(0, 255, 127, 0.15)',  // s4 green
              'rgba(255, 184, 0, 0.15)',  // s5 amber
              'rgba(191, 0, 255, 0.15)',  // s6 purple
              'rgba(0, 255, 127, 0.15)',  // s7 green
              'rgba(255, 184, 0, 0.15)',  // s8 amber
              'rgba(191, 0, 255, 0.15)',  // s9 purple
              'rgba(0, 255, 127, 0.2)'    // s10 green
            ][sceneIndex] || 'rgba(0, 255, 127, 0.15)'
          }}
          transition={{ duration: 1.5, ease: 'easeInOut' }}
        />

        {/* 8-12 Floating particles */}
        {[...Array(10)].map((_, i) => (
          <motion.div
            key={i}
            className={`absolute w-[${2 + (i%3)}vw] h-[${2 + (i%3)}vw] ${i%2===0 ? 'rounded-full' : 'rounded-sm'} mix-blend-screen opacity-30 pointer-events-none`}
            style={{ backgroundColor: ['#00FF7F', '#FFB800', '#BF00FF'][i%3] }}
            animate={{
              x: Array.from({length: 10}).map((_, sceneIdx) => `${Math.random() * 80 + 10}vw`)[sceneIndex] || '50vw',
              y: Array.from({length: 10}).map((_, sceneIdx) => `${Math.random() * 80 + 10}vh`)[sceneIndex] || '50vh',
              scale: Array.from({length: 10}).map((_, sceneIdx) => Math.random() * 0.8 + 0.6)[sceneIndex] || 1,
              rotate: Array.from({length: 10}).map((_, sceneIdx) => Math.random() * 180)[sceneIndex] || 0
            }}
            transition={{ duration: 2.5, ease: [0.25, 1, 0.5, 1] }}
          />
        ))}

        {/* Persistent vertical traveling horizontal accent line */}
        <motion.div
          className="absolute left-0 right-0 h-[3px] bg-[#00FF7F] z-10 pointer-events-none shadow-[0_0_20px_rgba(0,255,127,0.8)]"
          animate={{
            top: ['10%', '30%', '50%', '70%', '90%', '80%', '60%', '40%', '20%', '10%'][sceneIndex] || '10%',
            opacity: [0.6, 0.4, 0.8, 0.5, 0.7, 0.6, 0.5, 0.7, 0.4, 0.8][sceneIndex] || 0.6,
            backgroundColor: ['#00FF7F', '#FFB800', '#BF00FF', '#00FF7F', '#FFB800', '#BF00FF', '#00FF7F', '#FFB800', '#BF00FF', '#00FF7F'][sceneIndex] || '#00FF7F'
          }}
          transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
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