import { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Repeat, Volume2, VolumeX, Download, Loader2 } from 'lucide-react';
import VideoTemplate, { SCENE_DURATIONS } from './VideoTemplate';
import { useSceneControls } from './useSceneControls';

const PROGRESS_TICK_MS = 60;
const TOTAL_MS = Object.values(SCENE_DURATIONS).reduce((a, b) => a + b, 0);

// ── Recording ─────────────────────────────────────────────────────────────────

type RecordState = 'idle' | 'waiting' | 'recording' | 'processing' | 'done' | 'error';

function useBrowserRecord(onRestartVideo: () => void) {
  const [recState, setRecState] = useState<RecordState>('idle');
  const [recProgress, setRecProgress] = useState(0);
  const abortRef = useRef(false);

  const startRecording = useCallback(async () => {
    if (recState !== 'idle') return;
    abortRef.current = false;

    setRecState('waiting');

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: false,
        // @ts-ignore - Chrome-only hint to prefer the current tab
        preferCurrentTab: true,
        selfBrowserSurface: 'include',
      } as DisplayMediaStreamOptions);
    } catch {
      setRecState('error');
      setTimeout(() => setRecState('idle'), 4000);
      return;
    }

    if (abortRef.current) {
      stream.getTracks().forEach(t => t.stop());
      setRecState('idle');
      return;
    }

    // Restart the video from scene 1 so the full ad is captured
    onRestartVideo();
    // Short pause to let the video re-mount before recording starts
    await new Promise<void>(r => setTimeout(r, 600));

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';

    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      setRecState('processing');
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'raimzeal-ad.webm';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setRecState('done');
      setRecProgress(0);
      setTimeout(() => setRecState('idle'), 4000);
    };

    recorder.start(500);
    setRecState('recording');
    setRecProgress(0);

    // Progress ticker
    const startTime = performance.now();
    const tickId = window.setInterval(() => {
      const p = Math.min(1, (performance.now() - startTime) / TOTAL_MS);
      setRecProgress(p);
    }, 200);

    // Auto-stop after full video duration
    const stopTimer = setTimeout(() => {
      window.clearInterval(tickId);
      recorder.stop();
    }, TOTAL_MS + 800);

    // Also stop if user ends screen share early
    stream.getVideoTracks()[0].addEventListener('ended', () => {
      clearTimeout(stopTimer);
      window.clearInterval(tickId);
      if (recorder.state === 'recording') recorder.stop();
    });
  }, [recState, onRestartVideo]);

  const cancelRecording = useCallback(() => {
    abortRef.current = true;
    setRecState('idle');
    setRecProgress(0);
  }, []);

  return { recState, recProgress, startRecording, cancelRecording };
}

// ── Download button ────────────────────────────────────────────────────────────

function DownloadButton({
  recState,
  recProgress,
  onStart,
}: {
  recState: RecordState;
  recProgress: number;
  onStart: () => void;
}) {
  const labels: Record<RecordState, string> = {
    idle:       'Download MP4',
    waiting:    'Select this tab…',
    recording:  `Recording ${Math.round(recProgress * 100)}%`,
    processing: 'Saving…',
    done:       'Download started ✓',
    error:      'Permission denied — retry',
  };

  const isActive = recState !== 'idle' && recState !== 'error' && recState !== 'done';

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={onStart}
        disabled={isActive || recState === 'done'}
        className={`
          flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
          shadow-lg backdrop-blur-sm transition-all duration-200
          ${recState === 'error' ? 'bg-red-600/80 text-white cursor-pointer hover:bg-red-500/90 active:scale-95' : ''}
          ${recState === 'done'  ? 'bg-[#2E8B57] text-white cursor-default' : ''}
          ${recState === 'idle'  ? 'bg-[#2E8B57] hover:bg-[#3aa86a] active:scale-95 text-white cursor-pointer' : ''}
          ${isActive             ? 'bg-black/70 text-white/70 cursor-default' : ''}
        `}
        aria-label={labels[recState]}
      >
        {recState === 'recording' || recState === 'processing' || recState === 'waiting'
          ? <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          : <Download className="w-4 h-4 shrink-0" />
        }
        <span>{labels[recState]}</span>
      </button>

      {/* Progress bar — only visible while recording */}
      {recState === 'recording' && (
        <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#FF6B35] rounded-full transition-[width] duration-200"
            style={{ width: `${recProgress * 100}%` }}
          />
        </div>
      )}

      {recState === 'waiting' && (
        <p className="text-white/60 text-xs max-w-[180px] text-right leading-snug">
          Pick <strong className="text-white/90">this tab</strong> in the dialog, then recording starts automatically.
        </p>
      )}
    </div>
  );
}

// ── Progress segments ──────────────────────────────────────────────────────────

function ProgressSegments({
  sceneKeys,
  activeIndex,
  activeDuration,
  tick,
  onJumpTo,
}: {
  sceneKeys: string[];
  activeIndex: number;
  activeDuration: number;
  tick: number;
  onJumpTo: (index: number) => void;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setElapsed(0);
    const start = performance.now();
    const id = window.setInterval(() => {
      setElapsed(performance.now() - start);
    }, PROGRESS_TICK_MS);
    return () => window.clearInterval(id);
  }, [tick]);

  const progress = activeDuration > 0 ? Math.min(1, elapsed / activeDuration) : 0;

  return (
    <div className="flex-1 flex items-center gap-1.5">
      {sceneKeys.map((key, i) => {
        const isActive = i === activeIndex;
        const fill = isActive ? progress * 100 : 0;
        return (
          <button
            key={key}
            onClick={() => onJumpTo(i)}
            className="flex-1 h-3 bg-white/20 rounded-full overflow-hidden cursor-pointer hover:h-4 hover:bg-white/25 transition-all relative min-h-[12px]"
            aria-label={`Jump to scene ${i + 1}`}
            aria-current={isActive ? 'true' : undefined}
          >
            <div
              className="absolute inset-y-0 left-0 bg-[#2E8B57] rounded-full transition-[width] duration-100"
              style={{ width: `${fill}%` }}
            />
          </button>
        );
      })}
    </div>
  );
}

// ── Control bar ────────────────────────────────────────────────────────────────

function ControlBar({
  visible,
  collapsed,
  locked,
  muted,
  sceneKeys,
  activeIndex,
  activeDuration,
  tick,
  onToggleLock,
  onToggleMute,
  onJumpTo,
  onToggleCollapsed,
}: {
  visible: boolean;
  collapsed: boolean;
  locked: boolean;
  muted: boolean;
  sceneKeys: string[];
  activeIndex: number;
  activeDuration: number;
  tick: number;
  onToggleLock: () => void;
  onToggleMute: () => void;
  onJumpTo: (index: number) => void;
  onToggleCollapsed: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 bg-black/60 backdrop-blur-sm px-5 py-4 transition-all duration-200 ease-out ${
        visible
          ? 'translate-y-0 opacity-100 pointer-events-auto'
          : 'translate-y-full opacity-0 pointer-events-none'
      }`}
      aria-hidden={!visible}
    >
      <button
        onClick={onToggleLock}
        className={`w-14 h-14 flex items-center justify-center transition-colors rounded-lg shrink-0 ${
          locked
            ? 'text-white bg-[#2E8B57]/40 hover:bg-[#2E8B57]/60'
            : 'text-white/60 hover:text-white hover:bg-white/10'
        }`}
        title={locked ? 'Loop current scene: on' : 'Loop current scene: off'}
        aria-label={locked ? 'Loop current scene: on' : 'Loop current scene: off'}
        aria-pressed={locked}
      >
        <Repeat className="w-8 h-8" />
      </button>

      <button
        onClick={onToggleMute}
        className="w-14 h-14 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors rounded-lg shrink-0"
        title={muted ? 'Unmute audio' : 'Mute audio'}
        aria-label={muted ? 'Unmute audio' : 'Mute audio'}
        aria-pressed={muted}
      >
        {muted ? <VolumeX className="w-8 h-8" /> : <Volume2 className="w-8 h-8" />}
      </button>

      <div className="w-px self-stretch bg-white/15" aria-hidden="true" />

      <ProgressSegments
        sceneKeys={sceneKeys}
        activeIndex={activeIndex}
        activeDuration={activeDuration}
        tick={tick}
        onJumpTo={onJumpTo}
      />

      <div className="text-xl text-white/60 font-mono tabular-nums shrink-0">
        {activeIndex + 1}/{sceneKeys.length}
      </div>

      <button
        onClick={onToggleCollapsed}
        className="w-14 h-14 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors rounded-lg shrink-0"
        title={collapsed ? 'Show controls' : 'Hide controls'}
        aria-label={collapsed ? 'Show controls' : 'Hide controls'}
        aria-expanded={!collapsed}
      >
        {collapsed ? <ChevronUp className="w-10 h-10" /> : <ChevronDown className="w-10 h-10" />}
      </button>
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────────

export default function VideoWithControls() {
  const isIframed = typeof window !== 'undefined' && window.self !== window.top;

  const {
    sceneKeys, activeIndex, locked, mountKey, tick,
    durations, activeDuration, onSceneChange, jumpTo, toggleLock,
    restart,
  } = useSceneControls(SCENE_DURATIONS);

  const [muted, setMuted] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [tapPinned, setTapPinned] = useState(false);
  const sensorRef = useRef<HTMLDivElement | null>(null);

  const handleRestartVideo = useCallback(() => {
    restart();
  }, [restart]);

  const { recState, recProgress, startRecording } = useBrowserRecord(handleRestartVideo);

  const handlePointerEnter = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse') setHovering(true);
  }, []);
  const handlePointerLeave = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse') setHovering(false);
  }, []);
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse') return;
    if (collapsed) setTapPinned(true);
  }, [collapsed]);
  const handleToggleCollapsed = useCallback(() => {
    setCollapsed(c => {
      if (!c) { setHovering(false); setTapPinned(false); }
      return !c;
    });
  }, []);
  const handleToggleMute = useCallback(() => setMuted(m => !m), []);

  useEffect(() => {
    if (!(collapsed && tapPinned)) return;
    const onDocPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      const sensor = sensorRef.current;
      if (sensor && !sensor.contains(e.target as Node)) setTapPinned(false);
    };
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, [collapsed, tapPinned]);

  const barVisible = !collapsed || hovering || tapPinned;

  return (
    <div className="relative w-full h-screen">
      <VideoTemplate
        key={mountKey}
        durations={durations}
        loop
        muted={muted}
        onSceneChange={onSceneChange}
      />

      {/* Always-visible Download button — top-right, never hidden */}
      <div className="absolute top-4 right-4 z-50">
        <DownloadButton
          recState={recState}
          recProgress={recProgress}
          onStart={startRecording}
        />
      </div>

      <div
        ref={sensorRef}
        className="absolute bottom-0 left-0 right-0 z-50 flex flex-col justify-end"
        style={{ height: '25%' }}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
      >
        <div className="flex-1 w-full" aria-hidden="true" />
        <ControlBar
          visible={barVisible}
          collapsed={collapsed}
          locked={locked}
          muted={muted}
          sceneKeys={sceneKeys}
          activeIndex={activeIndex}
          activeDuration={activeDuration}
          tick={tick}
          onToggleLock={toggleLock}
          onToggleMute={handleToggleMute}
          onJumpTo={jumpTo}
          onToggleCollapsed={handleToggleCollapsed}
        />
      </div>
    </div>
  );
}
