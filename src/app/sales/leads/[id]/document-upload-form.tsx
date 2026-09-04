'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Upload, X } from 'lucide-react';
import type { LeadFileType } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { cn } from '@/lib/utils';
import { FILE_TYPE_LABEL, LEAD_FILE_TYPES } from '@/lib/leads';
import {
  ALLOWED_EXTENSIONS,
  formatFileSize,
  MAX_UPLOAD_BYTES,
  UPLOAD_ACCEPT,
} from '@/lib/upload-limits';
import { uploadLeadDocuments } from '../actions';

/**
 * PRD সেকশন ৫.১ — Lead Documents আপলোড।
 * drag & drop বা সাধারণ file picker, একসাথে একাধিক ফাইল; টাইপ ও বিবরণ পুরো
 * ব্যাচের জন্য প্রযোজ্য (একই ধরনের কয়েকটি ফাইল একবারে দেওয়াই স্বাভাবিক)।
 */
export function DocumentUploadForm({ leadId }: { leadId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  const tooLarge = files.filter((f) => f.size > MAX_UPLOAD_BYTES);

  /**
   * `<input type=file>` এর FileList read-only — তাই drag-drop এ পাওয়া ফাইল
   * সেখানে বসানো যায় না। বাছাই করা ফাইলগুলো state এ রেখে সাবমিটের সময়
   * নিজেরাই FormData বানানো হয়।
   */
  function addFiles(incoming: FileList | null) {
    if (!incoming || incoming.length === 0) return;
    setError(undefined);
    setFiles((current) => {
      const merged = [...current];
      for (const file of Array.from(incoming)) {
        const duplicate = merged.some((f) => f.name === file.name && f.size === file.size);
        if (!duplicate) merged.push(file);
      }
      return merged.slice(0, 10);
    });
  }

  function removeFile(index: number) {
    setFiles((current) => current.filter((_, i) => i !== index));
  }

  function reset() {
    setFiles([]);
    formRef.current?.reset();
    if (inputRef.current) inputRef.current.value = '';
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (files.length === 0) {
      setError('অন্তত একটি ফাইল নির্বাচন করুন');
      return;
    }
    if (tooLarge.length > 0) {
      setError(`${tooLarge[0].name} — ${formatFileSize(MAX_UPLOAD_BYTES)} এর বেশি`);
      return;
    }

    const form = new FormData(event.currentTarget);
    const payload = new FormData();
    payload.set('leadId', leadId);
    payload.set('fileType', String(form.get('fileType') ?? ''));
    payload.set('description', String(form.get('description') ?? ''));
    for (const file of files) {
      payload.append('files', file);
      // multipart এর filename হেডার latin-1 হিসেবে ডিকোড হয় — বাংলা নাম তখন
      // mojibake হয়ে যায়। তাই নামটি আলাদা টেক্সট ফিল্ডেও পাঠানো হয় (একই ক্রমে)।
      payload.append('fileNames', file.name);
    }

    setPending(true);
    const result = await uploadLeadDocuments(payload);
    setPending(false);

    if (!result.ok) {
      setError(result.fieldErrors?.fileType ?? result.message);
      toast.error(result.message);
      return;
    }

    setError(undefined);
    reset();
    toast.success(result.message);
    router.refresh();
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-3">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          addFiles(event.dataTransfer.files);
        }}
        className={cn(
          'rounded-md border border-dashed p-4 text-center transition-colors',
          dragging ? 'border-primary bg-primary/5' : 'border-input',
        )}
      >
        <Upload className="mx-auto h-5 w-5 text-muted-foreground" />
        <p className="mt-2 text-sm">
          ফাইল টেনে এনে ছাড়ুন, অথবা{' '}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="font-medium text-primary underline underline-offset-2"
          >
            বেছে নিন
          </button>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {ALLOWED_EXTENSIONS.join(', ')} · সর্বোচ্চ {formatFileSize(MAX_UPLOAD_BYTES)} প্রতি ফাইল
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={UPLOAD_ACCEPT}
          className="sr-only"
          onChange={(event) => addFiles(event.target.files)}
        />
      </div>

      {files.length > 0 ? (
        <ul className="space-y-1">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${index}`}
              className="flex items-center gap-2 rounded border bg-background px-2 py-1.5 text-sm"
            >
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <span
                className={cn(
                  'shrink-0 text-xs',
                  file.size > MAX_UPLOAD_BYTES ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                {formatFileSize(file.size)}
              </span>
              <button
                type="button"
                onClick={() => removeFile(index)}
                aria-label={`${file.name} সরান`}
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="doc-type">ফাইলের ধরন</Label>
          <NativeSelect id="doc-type" name="fileType" defaultValue={'FLOOR_PLAN' as LeadFileType}>
            {LEAD_FILE_TYPES.map((type) => (
              <option key={type} value={type}>
                {FILE_TYPE_LABEL[type]}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-2">
          <Label htmlFor="doc-description">বিবরণ (ঐচ্ছিক)</Label>
          <Input
            id="doc-description"
            name="description"
            placeholder="যেমন: ৩ বেড ফ্লোর প্ল্যান, প্রথম ড্রাফট"
            autoComplete="off"
          />
        </div>
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending || files.length === 0}>
          {pending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          {files.length > 0 ? `${files.length} টি ফাইল আপলোড` : 'আপলোড'}
        </Button>
      </div>
    </form>
  );
}
