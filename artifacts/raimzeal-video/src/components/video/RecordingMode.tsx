import { useEffect, useRef, useState } from 'react';
import VideoTemplate, { SCENE_DURATIONS } from './VideoTemplate';

const TOTAL_MS = Object.values(SCENE_DURATIONS).reduce((a, b) => a + b, 0);

type Phase = 'starting' | 'recording' | 'processing' | 'done' | 'error';

export default function RecordingMode() {
  const [phase, setPhase] = useState<Phase>('starting');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    async function run() {
      // Small delay so the video has time to mount and start playing
      await new Promise<void>(r => setTimeout(r, 800));

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: 30 },
          audio: true,
          // @ts-ignore Chrome-only
          preferCurrentTab: true,
          selfBrowserSurface: 'include',
        } as DisplayMediaStreamOptions);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setErrorMsg(msg.includes('denied') || msg.includes('cancel')
          ? 'Screen share cancelled. Close this tab and try again.'
          : `Could not start screen capture: ${msg}`);
        setPhase('error');
        return;
      }

      const mimeType = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm']
        .find(t => MediaRecorder.isTypeSupported(t)) ?? 'video/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        setPhase('processing');
        const blob = new Blob(chunks, { type: mimeType });
        const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `raimzeal-ad.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 15_000);
        setPhase('done');
        setProgress(1);
        setTimeout(() => window.close(), 3000);
      };

      recorder.start(500);
      setPhase('recording');

      const startTime = performance.now();
      const tickId = window.setInterval(() => {
        setProgress(Math.min(1, (performance.now() - startTime) / TOTAL_MS));
      }, 200);

      const stopTimer = setTimeout(() => {
        window.clearInterval(tickId);
        if (recorder.state === 'recording') recorder.stop();
      }, TOTAL_MS + 800);

      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        clearTimeout(stopTimer);
        window.clearInterval(tickId);
        if (recorder.state === 'recording') recorder.stop();
      });
    }

    run();
  }, []);

  const statusText: Record<Phase, string> = {
    starting:   'Starting recording…',
    recording:  `Recording — ${Math.round(progress * 100)}% (${Math.round((1 - progress) * TOTAL_MS / 1000)}s left)`,
    processing: 'Saving your video…',
    done:       'Download complete! This tab will close.',
    error:      errorMsg || 'Something went wrong.',
  };

  const barColor = phase === 'error' ? '#ef4444' : phase === 'done' ? '#2E8B57' : '#FF6B35';

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#0D1117]">
      {/* The actual video — plays cleanly for recording */}
      <VideoTemplate loop={false} muted={false} />

      {/* Minimal status overlay — top strip so it doesn't cover the ad */}
      <div className="absolute top-0 left-0 right-0 z-50 flex flex-col gap-0">
        {/* Progress bar */}
        <div className="h-1 w-full bg-white/10">
          <div
            className="h-full transition-[width] duration-200"
            style={{ width: `${progress * 100}%`, backgroundColor: barColor }}
          />
        </div>

        <div className="px-4 py-2 bg-black/70 backdrop-blur-sm flex items-center justify-between text-sm">
          <span className="text-white/80 font-medium">{statusText[phase]}</span>
          {phase === 'starting' && (
            <span className="text-white/50 text-xs">
              Select <strong className="text-white/80">this tab</strong> in the dialog
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
