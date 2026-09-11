'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, VideoOff } from 'lucide-react';

/**
 * HLS (`.m3u8`) লাইভ ফিডের প্লেয়ার — PRD সেকশন ৫.৪ ও ৫.৭।
 *
 * বেশিরভাগ NVR/DVR ও IP ক্যামেরা HLS দেয়, যা `<iframe>` এ বসে না। Safari ও iOS
 * এর `<video>` নিজেই HLS চালাতে পারে (`canPlayType`), তাই সেখানে বাড়তি কিছু
 * লোড করা হয় না — শুধু Chrome/Firefox/Android এ hls.js লাগে। লাইব্রেরিটি
 * (~150KB) তখনই `import()` হয়, ফলে যেসব কাস্টমারের ক্যামেরা নেই বা ভেন্ডরের
 * iframe প্লেয়ার আছে, তাদের বান্ডলে এটি যায় না — মোবাইল ডেটার হিসাবে এটা জরুরি
 * (CLAUDE.md নিয়ম ৩)।
 *
 * `autoPlay` + `muted` — ব্রাউজার শব্দসহ অটোপ্লে আটকায়; CC ফিডে শব্দ এমনিতেও
 * থাকে না, দর্শক চাইলে কন্ট্রোল থেকে চালু করতে পারেন।
 */
export function HlsPlayer({ url, title }: { url: string; title: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<'loading' | 'playing' | 'error'>('loading');

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // সেটআপ শেষ হওয়ার আগেই URL বদলে গেলে (বা কম্পোনেন্ট চলে গেলে) যেন পুরনো
    // hls ইনস্ট্যান্স পেছনে চলতে না থাকে
    let disposed = false;
    let destroy: (() => void) | undefined;

    setState('loading');

    const onPlaying = () => setState('playing');
    const onError = () => setState('error');
    video.addEventListener('playing', onPlaying);
    video.addEventListener('error', onError);

    // Safari / iOS — নেটিভ HLS, hls.js লাগে না
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.play().catch(() => {
        // অটোপ্লে আটকে গেলেও ফিডটি লোড হয়েছে — দর্শক play চাপবেন
        if (!disposed) setState('playing');
      });
    } else {
      void import('hls.js')
        .then(({ default: Hls }) => {
          if (disposed) return;
          if (!Hls.isSupported()) {
            setState('error');
            return;
          }

          const hls = new Hls({ lowLatencyMode: true });
          hls.loadSource(url);
          hls.attachMedia(video);
          hls.on(Hls.Events.ERROR, (_event, data) => {
            // non-fatal error এ hls.js নিজেই সামলে নেয় (segment drop ইত্যাদি) —
            // শুধু fatal হলে দর্শককে "দেখা যাচ্ছে না" বার্তা দেখাই
            if (data.fatal) setState('error');
          });

          destroy = () => hls.destroy();
        })
        .catch(() => {
          if (!disposed) setState('error');
        });
    }

    return () => {
      disposed = true;
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('error', onError);
      destroy?.();
    };
  }, [url]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-black">
      <video
        ref={videoRef}
        title={`${title} — লাইভ ক্যামেরা`}
        controls
        autoPlay
        muted
        playsInline
        className="h-full w-full"
      />

      {state === 'loading' ? (
        <Overlay>
          <Loader2 className="h-5 w-5 animate-spin" />
          ফিড লোড হচ্ছে…
        </Overlay>
      ) : null}

      {state === 'error' ? (
        <Overlay>
          <VideoOff className="h-5 w-5" />
          <span className="max-w-xs">
            এই মুহূর্তে ক্যামেরার ফিড পাওয়া যাচ্ছে না — কিছুক্ষণ পরে আবার চেষ্টা করুন।
          </span>
        </Overlay>
      ) : null}
    </div>
  );
}

/** ভিডিওর উপরের বার্তা — লোডিং ও ত্রুটি দুটোতেই একই চেহারা */
function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 p-4 text-center text-sm text-white">
      {children}
    </div>
  );
}
