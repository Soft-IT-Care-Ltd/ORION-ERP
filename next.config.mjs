/**
 * R2 এর পাবলিক হোস্ট — `next/image` (ফেজ ফটো গ্যালারি, `components/phase-timeline`)
 * remote URL শুধু allowlist করা হোস্ট থেকেই নেয়, তাই `R2_PUBLIC_URL` থেকে হোস্টটি
 * বের করে বসানো হয়। R2 কনফিগ না থাকলে (dev এ লোকাল `public/uploads/`) তালিকা খালি
 * থাকে — same-origin ছবির জন্য কিছু লাগে না।
 */
function r2RemotePatterns() {
  const raw = process.env.R2_PUBLIC_URL?.trim();
  if (!raw) return [];

  try {
    const url = new URL(raw);
    return [
      {
        protocol: url.protocol.replace(':', ''),
        hostname: url.hostname,
        pathname: '/**',
      },
    ];
  } catch {
    console.warn(`next.config: R2_PUBLIC_URL ("${raw}") একটি বৈধ URL নয় — উপেক্ষা করা হলো`);
    return [];
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    dirs: ['src'],
  },
  images: {
    remotePatterns: r2RemotePatterns(),
  },
};

export default nextConfig;
