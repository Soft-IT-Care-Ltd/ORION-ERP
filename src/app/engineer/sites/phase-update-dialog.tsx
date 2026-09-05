'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Camera, Loader2, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { PERCENT_OPTIONS } from '@/lib/phases';
import { formatFileSize, IMAGE_ACCEPT, MAX_UPLOAD_BYTES } from '@/lib/upload-limits';
import { submitPhaseUpdate } from './actions';

const MAX_PHOTOS = 10;

export type PhaseUpdateTarget = {
  id: string;
  name: string;
  percentComplete: number;
  /** পরিকল্পিত শেষের তারিখ পেরিয়ে গেছে — তখন দেরির কারণ চাওয়া হয় */
  isDelayed: boolean;
  delayReason: string | null;
};

type Picked = { file: File; previewUrl: string };

/**
 * PRD সেকশন ৫.২ — সাইট ইঞ্জিনিয়ারের ফেজ আপডেট ফর্ম।
 *
 * মোবাইল ব্রাউজার থেকেই মূলত ব্যবহার হবে (CLAUDE.md নিয়ম ৩), তাই: বড় স্লাইডার
 * (০/২৫/৫০/৭৫/১০০), এক ট্যাপে ক্যামেরা/গ্যালারি থেকে একাধিক ছবি, আর ছোট ফর্ম।
 */
export function PhaseUpdateDialog({ phase }: { phase: PhaseUpdateTarget }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [percent, setPercent] = useState(phase.percentComplete);
  const [photos, setPhotos] = useState<Picked[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  // dialog বন্ধ হলে বাছাই করা ছবি ও তাদের object URL ছেড়ে দেওয়া হয়
  useEffect(() => {
    if (open) return;
    setPhotos((current) => {
      current.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      return [];
    });
    setPercent(phase.percentComplete);
    setError(undefined);
  }, [open, phase.percentComplete]);

  function addPhotos(incoming: FileList | null) {
    if (!incoming || incoming.length === 0) return;

    // `input.files` একটি *live* FileList — নিচে input.value খালি করলেই এটিও খালি
    // হয়ে যায়। setPhotos এর updater রেন্ডারের সময় চলে (এখনই নয়), তাই ফাইলগুলো
    // আগেই সাধারণ অ্যারেতে কপি করে নেওয়া হয়।
    const incomingFiles = Array.from(incoming);

    setError(undefined);
    setPhotos((current) => {
      const merged = [...current];
      for (const file of incomingFiles) {
        const duplicate = merged.some((p) => p.file.name === file.name && p.file.size === file.size);
        if (!duplicate && merged.length < MAX_PHOTOS) {
          merged.push({ file, previewUrl: URL.createObjectURL(file) });
        }
      }
      return merged;
    });
    // একই ফাইল আবার বাছলে যেন change ইভেন্ট আসে
    if (inputRef.current) inputRef.current.value = '';
  }

  function removePhoto(index: number) {
    setPhotos((current) => {
      const target = current[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((_, i) => i !== index);
    });
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const oversized = photos.find((p) => p.file.size > MAX_UPLOAD_BYTES);
    if (oversized) {
      setError(`${oversized.file.name} — ${formatFileSize(MAX_UPLOAD_BYTES)} এর বেশি`);
      return;
    }

    const form = new FormData(event.currentTarget);
    const payload = new FormData();
    payload.set('phaseId', phase.id);
    payload.set('percentComplete', String(percent));
    payload.set('note', String(form.get('note') ?? ''));
    payload.set('delayReason', String(form.get('delayReason') ?? ''));
    for (const { file } of photos) {
      payload.append('photos', file);
      // বাংলা ফাইলনেম multipart হেডারে নষ্ট হয় — নামটি আলাদা ফিল্ডে একই ক্রমে
      payload.append('photoNames', file.name);
    }

    setPending(true);
    const result = await submitPhaseUpdate(payload);
    setPending(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return;
    }

    toast.success(result.message);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button size="sm" variant="outline" className="w-full md:w-auto" onClick={() => setOpen(true)}>
        <Pencil className="mr-2 h-3.5 w-3.5" />
        আপডেট
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{phase.name}</DialogTitle>
            <DialogDescription>
              অগ্রগতি, মন্তব্য ও সাইট ফটো দিন। সাবমিট করলে ফেজের % ও স্ট্যাটাস আপডেট হবে।
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <Label htmlFor={`percent-${phase.id}`}>কাজ সম্পন্ন</Label>
                <output
                  htmlFor={`percent-${phase.id}`}
                  className="text-2xl font-semibold tabular-nums"
                >
                  {percent}%
                </output>
              </div>
              <input
                id={`percent-${phase.id}`}
                type="range"
                min={0}
                max={100}
                step={25}
                value={percent}
                onChange={(event) => setPercent(Number(event.target.value))}
                className="h-6 w-full cursor-pointer accent-orion-gold"
                aria-describedby={`percent-ticks-${phase.id}`}
              />
              <div
                id={`percent-ticks-${phase.id}`}
                className="flex justify-between text-xs text-muted-foreground"
              >
                {PERCENT_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setPercent(option)}
                    className={cn(
                      'rounded px-1.5 py-0.5 tabular-nums transition-colors hover:bg-muted',
                      percent === option && 'font-semibold text-foreground',
                    )}
                  >
                    {option}%
                  </button>
                ))}
              </div>
              {percent !== phase.percentComplete ? (
                <p className="text-xs text-muted-foreground">
                  বর্তমান {phase.percentComplete}% থেকে {percent}% এ পরিবর্তন হবে
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor={`note-${phase.id}`}>মন্তব্য (ঐচ্ছিক)</Label>
              <Textarea
                id={`note-${phase.id}`}
                name="note"
                rows={3}
                placeholder="যেমন: ৩য় তলার স্ল্যাব ঢালাই শেষ, কিউরিং চলছে"
              />
            </div>

            {phase.isDelayed ? (
              <div className="space-y-2">
                <Label htmlFor={`delay-${phase.id}`}>দেরির কারণ</Label>
                <Input
                  id={`delay-${phase.id}`}
                  name="delayReason"
                  defaultValue={phase.delayReason ?? ''}
                  placeholder="যেমন: বৃষ্টির কারণে কাজ বন্ধ ছিল"
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  ফেজটি পরিকল্পিত তারিখ পেরিয়ে গেছে — কারণ লিখলে রিপোর্টে দেখা যাবে।
                </p>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor={`photos-${phase.id}`}>সাইট ফটো (ঐচ্ছিক)</Label>
              <input
                ref={inputRef}
                id={`photos-${phase.id}`}
                type="file"
                multiple
                accept={IMAGE_ACCEPT}
                className="sr-only"
                onChange={(event) => addPhotos(event.target.files)}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => inputRef.current?.click()}
                disabled={photos.length >= MAX_PHOTOS}
              >
                <Camera className="mr-2 h-4 w-4" />
                {photos.length === 0
                  ? 'ছবি তুলুন বা বেছে নিন'
                  : `আরও ছবি (${photos.length}/${MAX_PHOTOS})`}
              </Button>

              {photos.length > 0 ? (
                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {photos.map((photo, index) => (
                    <li key={photo.previewUrl} className="relative">
                      {/* বাছাই করা ফাইলের অস্থায়ী object URL — next/image এর দরকার নেই */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.previewUrl}
                        alt={photo.file.name}
                        className="aspect-square w-full rounded border object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        aria-label={`${photo.file.name} সরান`}
                        className="absolute -right-1.5 -top-1.5 rounded-full border bg-background p-1 shadow-sm hover:bg-muted"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                        {formatFileSize(photo.file.size)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {error ? <p className="text-xs text-destructive">{error}</p> : null}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                বাতিল
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                আপডেট সেভ করুন
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
