'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { markLedgerWhatsAppSent, markPaymentWhatsAppSent } from './actions';

/**
 * "Send via WhatsApp" — PRD সেকশন ৫.২ ও ৫.৫।
 *
 * MVP: `wa.me` deep-link নতুন ট্যাবে খোলে (prefilled মেসেজ, রসিদ PDF ম্যানুয়ালি
 * অ্যাটাচ করতে হয়)। খোলার পর রেকর্ডটি "পাঠানো হয়েছে" চিহ্নিত হয়, যাতে কোন
 * রসিদ হাতে নেওয়া হয়েছে তা তালিকা দেখেই বোঝা যায়।
 *
 * লিংকটি server এ তৈরি হয়ে আসে (`lib/whatsapp.ts`) — ফোন নম্বর ও মেসেজ তৈরির
 * নিয়ম এক জায়গায় থাকে, আর নম্বরটি কাজের মতো না হলে server ই `null` দেয়, তখন
 * বোতামটি রেন্ডারই হয় না।
 */
export function WhatsAppSendButton({
  url,
  entity,
  id,
  sentLabel,
  label = 'WhatsApp',
  iconOnly = false,
  size = 'sm',
  variant = 'outline',
  className,
}: {
  /** server এ তৈরি `wa.me` লিংক; null হলে (ফোন নম্বর নেই) কিছু দেখানো হয় না */
  url: string | null;
  entity: 'ledger' | 'payment';
  id: string;
  /** আগে পাঠানো হলে সেই তারিখ — বোতামের tooltip এ দেখায় */
  sentLabel?: string | null;
  label?: string;
  /**
   * শুধু আইকন — সরু টেবিলের সারিতে (যেমন সাম্প্রতিক পেমেন্ট তালিকা), যেখানে
   * পুরো লেখাসহ বোতাম বসালে বাকি কলামগুলো চেপে যেত। লেখাটি তখন `aria-label` ও
   * tooltip এ থাকে, তাই স্ক্রিন রিডারে কিছু হারায় না
   */
  iconOnly?: boolean;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!url) return null;

  function send() {
    // popup blocker এড়াতে ক্লিকের সরাসরি প্রতিক্রিয়ায় খোলা হয় — server call এর
    // জন্য অপেক্ষা করলে ব্রাউজার নতুন ট্যাবটি আটকে দিত
    window.open(url ?? '', '_blank', 'noopener,noreferrer');
    startTransition(async () => {
      const mark = entity === 'ledger' ? markLedgerWhatsAppSent : markPaymentWhatsAppSent;
      await mark({ id });
      router.refresh();
    });
  }

  const Icon = pending ? Loader2 : sentLabel ? Check : MessageCircle;

  return (
    <Button
      type="button"
      size={iconOnly ? 'icon' : size}
      variant={variant}
      disabled={pending}
      onClick={send}
      className={cn('whitespace-nowrap', iconOnly && 'h-8 w-8', className)}
      aria-label={iconOnly ? label : undefined}
      title={
        sentLabel ? `${sentLabel} এ পাঠানো হয়েছে — আবার পাঠাতে চাপুন` : iconOnly ? label : undefined
      }
    >
      <Icon
        className={cn(
          'h-3.5 w-3.5',
          !iconOnly && 'mr-1.5',
          pending && 'animate-spin',
          !pending && sentLabel && 'text-emerald-600',
        )}
      />
      {iconOnly ? null : label}
    </Button>
  );
}
