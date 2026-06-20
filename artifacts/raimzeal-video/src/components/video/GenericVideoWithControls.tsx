import { useRef, useState, useEffect, useCallback, type ComponentType } from 'react';
import { ChevronDown, ChevronUp, Repeat, Volume2, VolumeX, Download } from 'lucide-react';
import { useSceneControls } from './useSceneControls';

const PROGRESS_TICK_MS = 60;

function DownloadButton({ videoParam }: { videoParam: string }) {
  const [opened, setOpened] = useState(false);
  const handleClick = useCallback(() => {
    const base = window.location.href.split('?')[0];
    const url = `${base}?video=${videoParam}&rec`;
    window.open(url, '_blank', 'width=1280,height=720,toolbar=0,menubar=0,scrollbars=0');
    setOpened(true);
    setTimeout(() => setOpened(false), 4000);
  }, [videoParam]);
  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg backdrop-blur-sm transition-all duration-200 bg-[#C8A84B] hover:bg-[#d4b563] active:scale-95 text-[#0D0D0D] cursor-pointer"
      aria-label="Download MP4"
    >
      <Download className="w-4 h-4 shrink-0" />
      <span>{opened ? 'Recording tab opened ✓' : 'Download MP4'}</span>
    </button>
  );
}

function ProgressSegments({ sceneKeys, activeIndex, activeDuration, tick, onJumpTo }: {
  sceneKeys: string[]; activeIndex: number; activeDuration: number; tick: number; onJumpTo: (i: number) => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    setElapsed(0);
    const start = performance.now();
    const id = window.setInterval(() => setElapsed(performance.now() - start), PROGRESS_TICK_MS);
    return () => window.clearInterval(id);
  }, [tick]);
  const progress = activeDuration > 0 ? Math.min(1, elapsed / activeDuration) : 0;
  return (
    <div className="flex-1 flex items-center gap-1.5">
      {sceneKeys.map((key, i) => {
        const isActive = i === activeIndex;
        return (
          <button key={key} onClick={() => onJumpTo(i)}
            className="flex-1 h-3 bg-white/20 rounded-full overflow-hidden cursor-pointer hover:h-4 hover:bg-white/25 transition-all relative min-h-[12px]"
            aria-label={`Jump to scene ${i + 1}`} aria-current={isActive ? 'true' : undefined}>
            <div className="absolute inset-y-0 left-0 bg-[#C8A84B] rounded-full transition-[width] duration-100"
              style={{ width: isActive ? `${progress * 100}%` : '0%' }} />
          </button>
        );
      })}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function GenericVideoWithControls({ VideoComponent, sceneDurations, videoParam }: {
  VideoComponent: ComponentType<any>;
  sceneDurations: Record<string, number>;
  videoParam: string;
}) {
  const { sceneKeys, activeIndex, locked, mountKey, tick, durations, activeDuration, onSceneChange, jumpTo, toggleLock } = useSceneControls(sceneDurations);
  const [muted, setMuted] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [tapPinned, setTapPinned] = useState(false);
  const sensorRef = useRef<HTMLDivElement | null>(null);

  const handlePointerEnter = useCallback((e: React.PointerEvent) => { if (e.pointerType === 'mouse') setHovering(true); }, []);
  const handlePointerLeave = useCallback((e: React.PointerEvent) => { if (e.pointerType === 'mouse') setHovering(false); }, []);
  const handlePointerDown = useCallback((e: React.PointerEvent) => { if (e.pointerType === 'mouse') return; if (collapsed) setTapPinned(true); }, [collapsed]);
  const handleToggleCollapsed = useCallback(() => {
    setCollapsed(c => { if (!c) { setHovering(false); setTapPinned(false); } return !c; });
  }, []);

  useEffect(() => {
    if (!(collapsed && tapPinned)) return;
    const onDoc = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      const s = sensorRef.current;
      if (s && !s.contains(e.target as Node)) setTapPinned(false);
    };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, [collapsed, tapPinned]);

  const barVisible = !collapsed || hovering || tapPinned;

  return (
    <div className="relative w-full h-screen">
      <VideoComponent key={mountKey} durations={durations} loop muted={muted} onSceneChange={onSceneChange} />

      <div className="absolute top-4 right-4 z-50">
        <DownloadButton videoParam={videoParam} />
      </div>
      <div className="absolute top-4 left-4 z-50">
        <a href={window.location.href.split('?')[0]} className="text-[#888888] hover:text-[#C8A84B] text-sm font-semibold transition-colors">
          ← All Videos
        </a>
      </div>

      <div ref={sensorRef} className="absolute bottom-0 left-0 right-0 z-50 flex flex-col justify-end" style={{ height: '25%' }}
        onPointerEnter={handlePointerEnter} onPointerLeave={handlePointerLeave} onPointerDown={handlePointerDown}>
        <div className="flex-1 w-full" aria-hidden="true" />
        <div className={`flex items-center gap-3 bg-black/60 backdrop-blur-sm px-5 py-4 transition-all duration-200 ease-out ${
          barVisible ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-full opacity-0 pointer-events-none'}`}
          aria-hidden={!barVisible}>
          <button onClick={toggleLock}
            className={`w-14 h-14 flex items-center justify-center transition-colors rounded-lg shrink-0 ${
              locked ? 'text-white bg-[#C8A84B]/40 hover:bg-[#C8A84B]/60' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
            aria-label={locked ? 'Loop on' : 'Loop off'} aria-pressed={locked}>
            <Repeat className="w-8 h-8" />
          </button>
          <button onClick={() => setMuted(m => !m)}
            className="w-14 h-14 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors rounded-lg shrink-0"
            aria-label={muted ? 'Unmute' : 'Mute'} aria-pressed={muted}>
            {muted ? <VolumeX className="w-8 h-8" /> : <Volume2 className="w-8 h-8" />}
          </button>
          <div className="w-px self-stretch bg-white/15" aria-hidden="true" />
          <ProgressSegments sceneKeys={sceneKeys} activeIndex={activeIndex} activeDuration={activeDuration} tick={tick} onJumpTo={jumpTo} />
          <div className="text-xl text-white/60 font-mono tabular-nums shrink-0">{activeIndex + 1}/{sceneKeys.length}</div>
          <button onClick={handleToggleCollapsed}
            className="w-14 h-14 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors rounded-lg shrink-0"
            aria-label={collapsed ? 'Show controls' : 'Hide controls'} aria-expanded={!collapsed}>
            {collapsed ? <ChevronUp className="w-10 h-10" /> : <ChevronDown className="w-10 h-10" />}
          </button>
        </div>
      </div>
    </div>
  );
}
