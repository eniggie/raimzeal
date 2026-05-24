import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Camera, Plus, Trash2, Loader2, ImageIcon, Scale, X } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BottomNav } from '@/components/BottomNav';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

interface ProgressPhoto {
  id: string;
  storage_path: string;
  caption: string | null;
  weight_kg: number | null;
  body_fat_pct: number | null;
  taken_at: string;
  url: string | null;
}

export function ProgressPhotos() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<ProgressPhoto | null>(null);

  const [caption, setCaption] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [takenAt, setTakenAt] = useState(new Date().toISOString().split('T')[0]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function authHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return {};
    return { Authorization: `Bearer ${session.access_token}` };
  }

  async function load() {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/user/progress-photos', { headers });
      if (res.ok) {
        const d = await res.json() as { photos: ProgressPhoto[] };
        setPhotos(d.photos);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setShowForm(true);
    e.target.value = '';
  }

  async function handleUpload() {
    if (!pendingFile) return;
    setUploading(true);
    try {
      const headers = await authHeaders();
      const urlRes = await fetch('/api/user/progress-photos/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ filename: pendingFile.name, contentType: pendingFile.type }),
      });
      if (!urlRes.ok) throw new Error('Could not get upload URL');
      const { uploadUrl, storagePath } = await urlRes.json() as { uploadUrl: string; storagePath: string };

      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': pendingFile.type },
        body: pendingFile,
      });
      if (!uploadRes.ok) throw new Error('Upload failed');

      const saveRes = await fetch('/api/user/progress-photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          storage_path: storagePath,
          caption: caption || null,
          weight_kg: weightKg ? Number(weightKg) : null,
          body_fat_pct: bodyFat ? Number(bodyFat) : null,
          taken_at: takenAt,
        }),
      });
      if (!saveRes.ok) throw new Error('Could not save photo record');

      toast({ title: 'Progress photo saved!' });
      setPendingFile(null);
      setPreviewUrl(null);
      setCaption('');
      setWeightKg('');
      setBodyFat('');
      setTakenAt(new Date().toISOString().split('T')[0]);
      setShowForm(false);
      await load();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Upload failed', variant: 'destructive' });
    }
    setUploading(false);
  }

  async function handleDelete(id: string) {
    const headers = await authHeaders();
    await fetch(`/api/user/progress-photos/${id}`, { method: 'DELETE', headers });
    setPhotos(prev => prev.filter(p => p.id !== id));
    setSelected(null);
    toast({ title: 'Photo deleted' });
  }

  return (
    <div className="min-h-screen bg-background pb-nav">
      <div className="max-w-lg mx-auto px-4 pt-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/progress">
              <button className="p-2 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                <ChevronLeft className="h-5 w-5 text-muted-foreground" />
              </button>
            </Link>
            <div>
              <h1 className="text-xl font-bold">Progress Photos</h1>
              <p className="text-sm text-muted-foreground">Track your visual transformation</p>
            </div>
          </div>
          <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <Plus className="w-4 h-4 mr-1" /> Add Photo
          </Button>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />

        {/* Upload form */}
        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Card className="p-4 mb-6 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">New Progress Photo</span>
                  <button onClick={() => { setShowForm(false); setPendingFile(null); setPreviewUrl(null); }}>
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
                {previewUrl && (
                  <img src={previewUrl} alt="Preview" className="w-full rounded-xl object-cover max-h-64" />
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs mb-1">Date</Label>
                    <Input type="date" value={takenAt} onChange={e => setTakenAt(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs mb-1">Weight (kg)</Label>
                    <Input type="number" value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="Optional" className="h-8 text-sm" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs mb-1">Caption (optional)</Label>
                  <Input value={caption} onChange={e => setCaption(e.target.value)} placeholder="e.g. Week 4 check-in" />
                </div>
                <Button className="w-full" onClick={handleUpload} disabled={!pendingFile || uploading}>
                  {uploading ? <><Loader2 className="w-4 h-4 animate-spin mr-1" />Uploading…</> : <><Camera className="w-4 h-4 mr-1" />Save Photo</>}
                </Button>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary/40" /></div>
        ) : photos.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Camera className="w-14 h-14 mx-auto mb-4 opacity-30" />
            <p className="font-medium">No progress photos yet</p>
            <p className="text-sm mt-1">Tap "Add Photo" to capture your first check-in</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {photos.map(photo => (
              <motion.button
                key={photo.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => setSelected(photo)}
                className="relative rounded-2xl overflow-hidden aspect-square bg-muted/30 border border-border hover:border-primary/30 transition-colors"
              >
                {photo.url ? (
                  <img src={photo.url} alt={photo.caption ?? 'Progress photo'} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
                  </div>
                )}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                  <p className="text-white text-xs font-medium">{photo.taken_at}</p>
                  {photo.weight_kg && (
                    <p className="text-white/80 text-xs flex items-center gap-1"><Scale className="w-3 h-3" />{photo.weight_kg}kg</p>
                  )}
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* Photo detail modal */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}
          >
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-background rounded-2xl overflow-hidden max-w-sm w-full"
            >
              {selected.url && <img src={selected.url} alt="" className="w-full object-cover max-h-72" />}
              <div className="p-4 space-y-2">
                <p className="font-semibold">{selected.taken_at}</p>
                {selected.caption && <p className="text-sm text-muted-foreground">{selected.caption}</p>}
                <div className="flex gap-3 text-sm text-muted-foreground">
                  {selected.weight_kg && <span>⚖ {selected.weight_kg}kg</span>}
                  {selected.body_fat_pct && <span>🔥 {selected.body_fat_pct}% BF</span>}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setSelected(null)}>Close</Button>
                  <Button variant="destructive" size="icon" onClick={() => handleDelete(selected.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}
