import { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Share2, Copy, Check } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { AppState } from '@/lib/store';

const isClipboardImageSupported =
  typeof ClipboardItem !== 'undefined' &&
  typeof navigator !== 'undefined' &&
  typeof navigator.clipboard?.write === 'function';

interface ProgressShareCardProps {
  open: boolean;
  onClose: () => void;
  state: AppState;
}

export function ProgressShareCard({ open, onClose, state }: ProgressShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const latestWeight = state.bodyMeasurements[0]?.weight || state.user?.weight || 0;
  const previousWeight = state.bodyMeasurements[1]?.weight || latestWeight;
  const weightChange = latestWeight - previousWeight;

  const workoutsThisWeek = state.workoutLogs.filter(log => {
    const logDate = new Date(log.date);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return logDate >= weekAgo;
  }).length;

  const topPR = state.personalRecords[0];
  const units = state.user?.units === 'metric' ? 'kg' : 'lbs';

  const today = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const handleDownload = async () => {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `raimzeal-progress-${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export image', err);
    }
  };

  const handleCopy = async () => {
    if (!cardRef.current) return;
    if (!isClipboardImageSupported) {
      toast({
        description: 'Copy not supported — try Download instead.',
        variant: 'destructive',
      });
      return;
    }
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2 });
      const blob = await (await fetch(dataUrl)).blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ description: 'Copied to clipboard' });
    } catch (err) {
      const isApiError =
        err instanceof Error &&
        (err.name === 'NotAllowedError' || err.name === 'TypeError');
      if (isApiError) {
        toast({
          description: 'Copy not supported — try Download instead.',
          variant: 'destructive',
        });
      } else {
        toast({
          description: 'Failed to copy image.',
          variant: 'destructive',
        });
      }
    }
  };

  const handleShare = async () => {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2 });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'raimzeal-progress.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My RAIMZEAL Progress' });
      } else {
        handleDownload();
      }
    } catch {
      handleDownload();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Share Progress</DialogTitle>
        </DialogHeader>

        {/* The card that gets exported */}
        <div
          ref={cardRef}
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 50%, #16213e 100%)',
            padding: '28px 24px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#ffffff', letterSpacing: -0.5 }}>
                RAIMZEAL
              </div>
              <div style={{ fontSize: 11, color: '#8B31C7', fontWeight: 600, letterSpacing: 1.5, marginTop: 2 }}>
                MY PROGRESS
              </div>
            </div>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'linear-gradient(135deg, #8B31C7, #C9A84C)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 18 }}>💪</span>
            </div>
          </div>

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {/* Streak */}
            <div style={{
              background: 'rgba(139, 49, 199, 0.15)',
              borderRadius: 14, padding: '14px 12px',
              border: '1px solid rgba(139, 49, 199, 0.3)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 14 }}>🔥</span>
                <span style={{ fontSize: 11, color: '#a0a0b0', fontWeight: 500 }}>Streak</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
                {state.streak}
              </div>
              <div style={{ fontSize: 11, color: '#8B31C7', marginTop: 4, fontWeight: 600 }}>days</div>
            </div>

            {/* Weight */}
            <div style={{
              background: 'rgba(46, 139, 87, 0.15)',
              borderRadius: 14, padding: '14px 12px',
              border: '1px solid rgba(46, 139, 87, 0.3)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 14 }}>⚖️</span>
                <span style={{ fontSize: 11, color: '#a0a0b0', fontWeight: 500 }}>Weight</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
                {latestWeight || '—'}
              </div>
              <div style={{ fontSize: 11, color: weightChange <= 0 ? '#2E8B57' : '#e55', marginTop: 4, fontWeight: 600 }}>
                {latestWeight > 0
                  ? `${weightChange <= 0 ? '↓' : '↑'} ${Math.abs(weightChange).toFixed(1)} ${units}`
                  : units}
              </div>
            </div>

            {/* Workouts */}
            <div style={{
              background: 'rgba(201, 168, 76, 0.15)',
              borderRadius: 14, padding: '14px 12px',
              border: '1px solid rgba(201, 168, 76, 0.3)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 14 }}>🏋️</span>
                <span style={{ fontSize: 11, color: '#a0a0b0', fontWeight: 500 }}>This Week</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
                {workoutsThisWeek}
              </div>
              <div style={{ fontSize: 11, color: '#C9A84C', marginTop: 4, fontWeight: 600 }}>workouts</div>
            </div>

            {/* Top PR */}
            <div style={{
              background: 'rgba(229, 85, 85, 0.12)',
              borderRadius: 14, padding: '14px 12px',
              border: '1px solid rgba(229, 85, 85, 0.25)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 14 }}>🏆</span>
                <span style={{ fontSize: 11, color: '#a0a0b0', fontWeight: 500 }}>Top PR</span>
              </div>
              {topPR ? (
                <>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
                    {topPR.weight}
                  </div>
                  <div style={{ fontSize: 10, color: '#e55', marginTop: 4, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {units} · {topPR.exercise}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>No PRs yet</div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)',
          }}>
            <div style={{ fontSize: 11, color: '#555' }}>{today}</div>
            <div style={{ fontSize: 11, color: '#555', fontWeight: 600 }}>raimzeal.com</div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-1">
          <Button variant="outline" className="flex-1" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
          <div className="flex-1 flex flex-col items-center gap-1">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleCopy}
              disabled={!isClipboardImageSupported}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2 text-green-500" />
                  <span className="text-green-500">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Image
                </>
              )}
            </Button>
            {!isClipboardImageSupported && (
              <p className="text-xs text-muted-foreground text-center leading-tight">
                Not supported in this browser — use Download
              </p>
            )}
          </div>
          <Button className="flex-1" onClick={handleShare}>
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
