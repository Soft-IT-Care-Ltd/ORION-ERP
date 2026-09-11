import { CalendarDays, Layers, MapPin, Wallet } from 'lucide-react';
import { cn, formatBDT } from '@/lib/utils';
import type { CustomerProject } from '@/lib/customer-data';
import { buildingTypeLabel } from '@/lib/leads';
import { PROJECT_STATUS_BADGE, PROJECT_STATUS_HINT, PROJECT_STATUS_LABEL } from '@/lib/projects';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * PRD সেকশন ৫.৭ — "নিজের প্রজেক্টের সামারি (location, building type, floors,
 * start date, total contract value)" — সঙ্গে দুটি অগ্রগতির বার (নির্মাণ ও আদায়)।
 *
 * কাস্টমাররা মূলত মোবাইল ব্রাউজারে দেখেন (CLAUDE.md নিয়ম ৩), তাই ফিল্ডগুলো
 * মোবাইলে ২ কলাম, sm থেকে ৪ কলাম।
 */
export function ProjectSummaryCard({
  project,
  constructionPercent,
  collectedPercent,
  className,
}: {
  project: CustomerProject;
  /** ফেজ টাইমলাইন থেকে মোট অগ্রগতি */
  constructionPercent: number;
  /** পেমেন্ট প্ল্যান থেকে আদায়ের হার */
  collectedPercent: number;
  className?: string;
}) {
  const building = buildingTypeLabel(project.buildingType);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base">{project.title}</CardTitle>
            {project.landLocation ? (
              <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{project.landLocation}</span>
              </p>
            ) : null}
          </div>
          <span
            title={PROJECT_STATUS_HINT[project.status]}
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
              PROJECT_STATUS_BADGE[project.status],
            )}
          >
            {PROJECT_STATUS_LABEL[project.status]}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Field
            label="বাড়ির ধরন"
            value={building ?? '—'}
            icon={<Layers className="h-3.5 w-3.5" />}
          />
          <Field
            label="তলা / আয়তন"
            value={
              [project.floors ? `${project.floors} তলা` : null, project.totalSqft ? `${project.totalSqft} sqft` : null]
                .filter(Boolean)
                .join(' · ') || '—'
            }
          />
          <Field
            label="নির্মাণ শুরু"
            value={project.startDateLabel ?? '—'}
            icon={<CalendarDays className="h-3.5 w-3.5" />}
          />
          <Field
            label="কন্ট্রাক্ট ভ্যালু"
            value={formatBDT(project.totalContractValue)}
            icon={<Wallet className="h-3.5 w-3.5" />}
          />
        </dl>

        <div className="grid gap-3 border-t pt-3 sm:grid-cols-2">
          <MiniBar
            label="নির্মাণ অগ্রগতি"
            percent={constructionPercent}
            fill={constructionPercent >= 100 ? 'bg-emerald-600' : 'bg-orion-gold'}
          />
          <MiniBar label="পেমেন্ট পরিশোধ" percent={collectedPercent} fill="bg-emerald-600" />
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="truncate font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function MiniBar({ label, percent, fill }: { label: string; percent: number; fill: string }) {
  const value = Math.min(100, Math.max(0, Math.round(percent)));

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{value}%</span>
      </div>
      <div
        className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className={cn('h-full rounded-full', fill)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
