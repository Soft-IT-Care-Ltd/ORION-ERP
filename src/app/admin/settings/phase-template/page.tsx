import { permanentRedirect } from 'next/navigation';

/**
 * ফেজ টেমপ্লেট পেজটির আসল ঠিকানা `/admin/phase-templates` (সাইডবারে ওটিই আছে)।
 * এই রুটটি শুধু পুরনো/বিকল্প লিংক ধরে আসা ইউজারকে সেখানে পাঠায় — দুই জায়গায়
 * একই পেজের দুটি কপি রাখলে একটিতে করা এডিট অন্যটিতে দেখা যেত না।
 */
export default function PhaseTemplateSettingsRedirect(): never {
  permanentRedirect('/admin/phase-templates');
}
