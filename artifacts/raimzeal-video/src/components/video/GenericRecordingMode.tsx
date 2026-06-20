import { useEffect, useRef, useState, type ComponentType } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

type Phase = 'starting' | 'recording' | 'converting' | 'done' | 'error';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function GenericRecordingMode({ VideoComponent, totalMs, filename }: {
  VideoComponent: ComponentType<any>;
  totalMs: number;
  filename: string;
}) {
  const [phase, setPhase] = useState<Phase>('starting');
  const [recProgress, setRecProgress] = useState(0);
  const [convProgress, setConvProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    async function run() {
      await new Promise<void>(r => setTimeout(r, 800));
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: 30 }, audio: true,
          // @ts-ignore
          preferCurrentTab: true, selfBrowserSurface: 'include',
        } as DisplayMediaStreamOptions);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setErrorMsg(msg.toLowerCase().includes('denied') || msg.toLowerCase().includes('cancel')
          ? 'Screen share cancelled. Close this tab and try again.'
          : `Could not start screen capture: ${msg}`);
        setPhase('error');
        return;
      }

      const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
        .find(t => MediaRecorder.isTypeSupported(t)) ?? 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setPhase('converting');
        setConvProgress(0);
        const webmBlob = new Blob(chunks, { type: mimeType });
        try {
          const base = import.meta.env.BASE_URL as string;
          const ffmpeg = new FFmpeg();
          ffmpeg.on('progress', ({ progress }) => setConvProgress(Math.min(1, progress)));
          await ffmpeg.load({
            coreURL: await toBlobURL(`${base}ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${base}ffmpeg-core.wasm`, 'application/wasm'),
          });
          await ffmpeg.writeFile('input.webm', await fetchFile(webmBlob));
          await ffmpeg.exec(['-i', 'input.webm', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', 'output.mp4']);
          const data = await ffmpeg.readFile('output.mp4');
          const mp4Blob = new Blob([data as unknown as BlobPart], { type: 'video/mp4' });
          const url = URL.createObjectURL(mp4Blob);
          const a = document.createElement('a');
          a.href = url; a.download = filename;
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 15_000);
          setConvProgress(1); setPhase('done');
          setTimeout(() => window.close(), 3000);
        } catch (e: unknown) {
          setErrorMsg(`MP4 conversion failed: ${e instanceof Error ? e.message : String(e)}`);
          setPhase('error');
        }
      };

      recorder.start(500);
      setPhase('recording');
      const startTime = performance.now();
      const tickId = window.setInterval(() => setRecProgress(Math.min(1, (performance.now() - startTime) / totalMs)), 200);
      const stopTimer = setTimeout(() => {
        window.clearInterval(tickId);
        if (recorder.state === 'recording') recorder.stop();
      }, totalMs + 800);
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        clearTimeout(stopTimer); window.clearInterval(tickId);
        if (recorder.state === 'recording') recorder.stop();
      });
    }
    run();
  }, [totalMs, filename]);

  const statusLine = {
    starting: 'Starting…  Select this tab in the dialog',
    recording: `Recording ${Math.round(recProgress * 100)}%  —  ${Math.round((1 - recProgress) * totalMs / 1000)}s left`,
    converting: convProgress < 0.05 ? 'Loading MP4 encoder…' : `Converting to MP4… ${Math.round(convProgress * 100)}%`,
    done: `${filename} saved!  Closing…`,
    error: errorMsg || 'Something went wrong.',
  }[phase];

  const barPct = phase === 'recording' ? recProgress * 100 : phase === 'converting' ? convProgress * 100 : phase === 'done' ? 100 : 0;
  const barColor = phase === 'error' ? '#ef4444' : phase === 'done' ? '#2D8C4E' : phase === 'converting' ? '#C8A84B' : '#2D8C4E';

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#0D0D0D]">
      <VideoComponent loop={false} muted={false} />
      <div className="absolute top-0 left-0 right-0 z-50">
        <div className="h-1 w-full bg-white/10">
          <div className="h-full transition-[width] duration-300 ease-out" style={{ width: `${barPct}%`, backgroundColor: barColor }} />
        </div>
        <div className="px-4 py-2 bg-black/75 backdrop-blur-sm flex items-center gap-3 text-sm">
          {(phase === 'starting' || phase === 'recording' || phase === 'converting') && (
            <span className="inline-block w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin shrink-0" />
          )}
          <span className={`font-medium ${phase === 'error' ? 'text-red-400' : phase === 'done' ? 'text-[#2D8C4E]' : 'text-white/90'}`}>
            {statusLine}
          </span>
        </div>
      </div>
    </div>
  );
}
