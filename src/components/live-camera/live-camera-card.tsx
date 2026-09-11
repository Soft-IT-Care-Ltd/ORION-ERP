import { ExternalLink, Video, VideoOff } from 'lucide-react';
import { cameraStreamKind } from '@/lib/projects';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HlsPlayer } from './hls-player';

/**
 * PRD সেকশন ৫.৪ ও ৫.৭ — সাইটের লাইভ CC ক্যামেরা।
 *
 * তিনটি অবস্থা, তিনটিই এই কার্ডেই:
 *  ১. **HLS** (`.m3u8`) — NVR/DVR এর স্বাভাবিক আউটপুট; `<video>` + hls.js
 *     (client component, লাইব্রেরিটি তখনই লোড হয়)।
 *  ২. **অন্য embed** — ভেন্ডরের প্লেয়ার পেজ বা YouTube live; `<iframe>`।
 *  ৩. **লিংক নেই / ভুল লিংক** — "এই মুহূর্তে লাইভ ক্যামেরা সংযুক্ত নেই" বার্তা।
 *     কার্ডটি তখনো দেখানো হয়, কারণ কাস্টমার যেন বুঝতে পারেন সুবিধাটি আছে, শুধু
 *     তার সাইটে এখনো ক্যামেরা বসেনি — কিছু না দেখালে ব্যাপারটা "নষ্ট" মনে হতো।
 *
 * URL টি server এ যাচাই হয়ে আসে (`cameraStreamKind` → `isEmbeddableStreamUrl`),
 * তাই শুধু http/https ই এখানে পৌঁছায় — কোনো স্ক্রিপ্ট-স্কিম কাস্টমারের
 * ব্রাউজারে চলে না; iframe টিকে `sandbox` দিয়ে আলাদা করেও রাখা হয়।
 */
export function LiveCameraCard({
  url,
  title,
  id,
}: {
  /** অ্যাডমিনের বসানো stream URL — না থাকলে (বা অবৈধ হলে) বার্তা দেখানো হয় */
  url: string | null | undefined;
  title: string;
  /** পাতার ভেতরে "লাইভ ক্যামেরা" চিপ থেকে এখানে আসার জন্য */
  id?: string;
}) {
  const kind = cameraStreamKind(url);

  return (
    <Card id={id} className="scroll-mt-20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {kind ? (
            <Video className="h-4 w-4 text-muted-foreground" />
          ) : (
            <VideoOff className="h-4 w-4 text-muted-foreground" />
          )}
          লাইভ ক্যামেরা
        </CardTitle>
        <CardDescription>
          {kind
            ? 'সাইটের সরাসরি ফিড — কখনো না দেখালে নিচের লিংক থেকে নতুন ট্যাবে খুলে দেখুন।'
            : 'সাইটে CC ক্যামেরা বসানো হলে এখান থেকেই সরাসরি দেখতে পারবেন।'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-2">
        {kind === null ? (
          <p className="flex flex-col items-center gap-2 rounded-md border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            <VideoOff className="h-7 w-7" />
            এই মুহূর্তে লাইভ ক্যামেরা সংযুক্ত নেই
          </p>
        ) : kind === 'hls' ? (
          <HlsPlayer url={url as string} title={title} />
        ) : (
          <div className="aspect-video w-full overflow-hidden rounded-md border bg-muted">
            <iframe
              src={url as string}
              title={`${title} — লাইভ ক্যামেরা`}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              referrerPolicy="no-referrer"
              sandbox="allow-scripts allow-same-origin allow-presentation"
              className="h-full w-full"
            />
          </div>
        )}

        {kind ? (
          <a
            href={url as string}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            নতুন ট্যাবে খুলুন
          </a>
        ) : null}
      </CardContent>
    </Card>
  );
}
