import Image from 'next/image';
import Link from 'next/link';
import { BRAND, markSize } from '@/lib/brand';
import { cn } from '@/lib/utils';

export type MarkVariant = 'default' | 'reversed' | 'white' | 'outline' | 'black';

const MARK_SRC: Record<MarkVariant, string> = {
  default: BRAND.logo.mark,
  reversed: BRAND.logo.markReversed,
  white: BRAND.logo.markWhite,
  outline: BRAND.logo.markOutline,
  black: BRAND.logo.markBlack,
};

/**
 * শুধু লোগো মার্ক (৩টি বার = Orion's Belt)।
 *
 * `unoptimized` — সোর্স SVG, Next এর image optimizer SVG রি-এনকোড করে না
 * (`dangerouslyAllowSVG` ছাড়া error দেয়); SVG এমনিতেই resolution-independent।
 */
export function OrionMark({
  size = 32,
  variant = 'default',
  className,
  priority = false,
  alt = '',
}: {
  /** width (px) — height ন্যাটিভ 50:45 ratio ধরে হিসাব হয় */
  size?: number;
  variant?: MarkVariant;
  className?: string;
  priority?: boolean;
  /** পাশে wordmark টেক্সট থাকলে খালি রাখুন (decorative) */
  alt?: string;
}) {
  const { width, height } = markSize(size);

  return (
    <Image
      src={MARK_SRC[variant]}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      unoptimized
      className={cn('shrink-0 select-none', className)}
    />
  );
}

/**
 * মার্ক + "Orion Builders" wordmark — sidebar/header এর জন্য horizontal lockup।
 * `href` দিলে পুরোটা ক্লিকযোগ্য হয়ে সংশ্লিষ্ট প্যানেলের ড্যাশবোর্ডে নিয়ে যায়।
 */
export function OrionLockup({
  href,
  size = 28,
  variant = 'default',
  showWordmark = true,
  className,
  onNavigate,
}: {
  href?: string;
  size?: number;
  variant?: MarkVariant;
  showWordmark?: boolean;
  className?: string;
  /** মোবাইল drawer এর মতো জায়গায় — ক্লিকের পর প্যানেল বন্ধ করতে */
  onNavigate?: () => void;
}) {
  const content = (
    <>
      <OrionMark size={size} variant={variant} />
      {showWordmark ? (
        <span className="truncate font-heading text-sm font-bold tracking-tight">
          {BRAND.name}
        </span>
      ) : null}
    </>
  );

  const classes = cn('flex min-w-0 items-center gap-2', className);

  if (!href) return <span className={classes}>{content}</span>;

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-label={`${BRAND.name} — ড্যাশবোর্ড`}
      className={cn(
        classes,
        'rounded-md outline-none transition-opacity hover:opacity-80',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      )}
    >
      {content}
    </Link>
  );
}
