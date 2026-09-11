import { ExternalLink, Video } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * PRD সেকশন ৫.৪ ও ৫.৭ — সাইটের লাইভ CC ক্যামেরা।
 *
 * MVP: অ্যাডমিনের বসানো stream/share URL সরাসরি `<iframe>` এ embed হয় (ভেন্ডরের
 * প্লেয়ার বা HLS পেজ)। ক্যামেরা hardware integration এই সফটওয়্যারের স্কোপের
 * বাইরে। URL টি server এ যাচাই হয়ে আসে (`isEmbeddableStreamUrl`) — শুধু
 * http/https, যাতে কোনো স্ক্রিপ্ট-স্কিম কাস্টমারের ব্রাউজারে না চলে; `sandbox`
 * দিয়ে embed টিকে আলাদা করেও রাখা হয়।
 */
export function LiveCameraCard({ url, title }: { url: string; title: string }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Video className="h-4 w-4 text-muted-foreground" />
          লাইভ ক্যামেরা
        </CardTitle>
        <CardDescription>
          সাইটের সরাসরি ফিড — কখনো না দেখালে নিচের লিংক থেকে নতুন ট্যাবে খুলে দেখুন।
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="aspect-video w-full overflow-hidden rounded-md border bg-muted">
          <iframe
            src={url}
            title={`${title} — লাইভ ক্যামেরা`}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-same-origin allow-presentation"
            className="h-full w-full"
          />
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-3 w-3 shrink-0" />
          নতুন ট্যাবে খুলুন
        </a>
      </CardContent>
    </Card>
  );
}
