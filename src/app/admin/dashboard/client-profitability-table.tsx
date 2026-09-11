'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { STAGE_LABEL } from '@/lib/leads';
import {
  sortClientProfit,
  type ClientProfitReport,
  type ClientProfitRow,
  type ClientProfitSort,
  type SortDirection,
} from '@/lib/reports';
import { cn, formatBDT } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/**
 * PRD সেকশন ৫.১০ — Client-wise profitability ("billed − cost = margin, sortable")।
 *
 * সাজানোটা ক্লায়েন্ট-সাইডে, সার্ভার রাউন্ড-ট্রিপ ছাড়া: সারির সংখ্যা ক্লায়েন্টের
 * সংখ্যার সমান (শত-খানেক), তাই পুরো তালিকাটাই একবারে আসে আর হেডারে ক্লিক করলে
 * সাথে সাথে ক্রম বদলায়। ডিফল্ট — মার্জিন descending (সবচেয়ে লাভজনক উপরে)।
 *
 * লেআউট: মোবাইলে কার্ড, md থেকে টেবিল (CLAUDE.md নিয়ম ৩)।
 */

/** প্রথমে এতগুলো সারি — বাকিগুলো "সব দেখুন" এ */
const PREVIEW_ROWS = 8;

type Column = {
  key: ClientProfitSort;
  label: string;
  /** সংখ্যার কলাম ডানে, নাম বামে */
  numeric: boolean;
  /** ছোট পর্দায় জায়গা বাঁচাতে কিছু কলাম lg এর নিচে লুকানো */
  className?: string;
  value: (row: ClientProfitRow) => number;
  tone?: (row: ClientProfitRow) => string | undefined;
};

const COLUMNS: Column[] = [
  {
    key: 'billed',
    label: 'মোট বিল',
    numeric: true,
    value: (row) => row.totalBilled,
  },
  {
    key: 'received',
    label: 'আদায়',
    numeric: true,
    className: 'hidden lg:table-cell',
    value: (row) => row.totalReceived,
  },
  {
    key: 'cost',
    label: 'ইন্টারনাল কস্ট',
    numeric: true,
    value: (row) => row.totalCost,
  },
  {
    key: 'margin',
    label: 'নিট মার্জিন',
    numeric: true,
    value: (row) => row.netMargin,
    tone: (row) =>
      row.netMargin >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive',
  },
];

export function ClientProfitabilityTable({ report }: { report: ClientProfitReport }) {
  const [sort, setSort] = useState<ClientProfitSort>('margin');
  const [direction, setDirection] = useState<SortDirection>('desc');
  const [expanded, setExpanded] = useState(false);

  const sorted = useMemo(
    () => sortClientProfit(report.rows, sort, direction),
    [report.rows, sort, direction],
  );

  function toggle(key: ClientProfitSort) {
    if (key === sort) {
      setDirection((current) => (current === 'desc' ? 'asc' : 'desc'));
      return;
    }
    setSort(key);
    // নতুন কলামে প্রথম ক্লিকে যেটা বেশি কাজে লাগে: নামে অ-আ-ক-খ, টাকায় বড় থেকে ছোট
    setDirection(key === 'name' ? 'asc' : 'desc');
  }

  if (report.rows.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        এখনো কোনো ক্লায়েন্টের বিল বা খরচ লেজারে ওঠেনি
      </p>
    );
  }

  const visible = expanded ? sorted : sorted.slice(0, PREVIEW_ROWS);

  return (
    <div className="space-y-3">
      {/* ---------------------------------------------------- মোবাইল কার্ড */}
      <div className="md:hidden">
        <SortPicker sort={sort} direction={direction} onToggle={toggle} />
        <ul className="mt-2 space-y-2">
          {visible.map((row) => (
            <li key={row.leadId} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <ClientName row={row} />
                  <p className="truncate text-xs text-muted-foreground">
                    {row.projectTitle ?? STAGE_LABEL[row.stage]}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={cn(
                      'font-semibold tabular-nums',
                      row.netMargin >= 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-destructive',
                    )}
                  >
                    {formatBDT(row.netMargin)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.marginRate === null ? 'মার্জিন —' : `মার্জিন ${row.marginRate}%`}
                  </p>
                </div>
              </div>
              <dl className="mt-2 grid grid-cols-3 gap-2 border-t pt-2 text-xs">
                <Cell label="বিল" value={formatBDT(row.totalBilled)} />
                <Cell label="আদায়" value={formatBDT(row.totalReceived)} />
                <Cell label="কস্ট" value={formatBDT(row.totalCost)} />
              </dl>
            </li>
          ))}
        </ul>
      </div>

      {/* -------------------------------------------------- ডেস্কটপ টেবিল */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th scope="col" className="py-2 pr-3 text-left font-medium">
                <SortButton
                  label="ক্লায়েন্ট"
                  active={sort === 'name'}
                  direction={direction}
                  onClick={() => toggle('name')}
                />
              </th>
              {COLUMNS.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn('py-2 pl-3 text-right font-medium', column.className)}
                >
                  <SortButton
                    label={column.label}
                    align="right"
                    active={sort === column.key}
                    direction={direction}
                    onClick={() => toggle(column.key)}
                  />
                </th>
              ))}
              <th scope="col" className="py-2 pl-3 text-right font-medium">
                মার্জিন %
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.leadId} className="border-b last:border-b-0 hover:bg-muted/40">
                <td className="max-w-[16rem] py-2 pr-3">
                  <ClientName row={row} />
                  <p className="truncate text-xs text-muted-foreground">
                    {row.projectTitle ?? STAGE_LABEL[row.stage]}
                  </p>
                </td>
                {COLUMNS.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'py-2 pl-3 text-right tabular-nums',
                      column.className,
                      column.tone?.(row),
                      column.key === 'margin' && 'font-medium',
                    )}
                  >
                    {formatBDT(column.value(row))}
                  </td>
                ))}
                <td className="py-2 pl-3 text-right tabular-nums text-muted-foreground">
                  {row.marginRate === null ? '—' : `${row.marginRate}%`}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 text-sm font-medium">
              <th scope="row" className="py-2 pr-3 text-left">
                সব ক্লায়েন্ট মিলিয়ে ({report.rows.length})
              </th>
              <td className="py-2 pl-3 text-right tabular-nums">
                {formatBDT(report.totalBilled)}
              </td>
              <td className="hidden py-2 pl-3 text-right tabular-nums lg:table-cell">
                {formatBDT(report.totalReceived)}
              </td>
              <td className="py-2 pl-3 text-right tabular-nums">{formatBDT(report.totalCost)}</td>
              <td
                className={cn(
                  'py-2 pl-3 text-right tabular-nums',
                  report.netMargin >= 0
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-destructive',
                )}
              >
                {formatBDT(report.netMargin)}
              </td>
              <td className="py-2 pl-3" />
            </tr>
          </tfoot>
        </table>
      </div>

      {sorted.length > PREVIEW_ROWS ? (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded
            ? 'কম দেখান'
            : `আরও ${sorted.length - PREVIEW_ROWS} টি ক্লায়েন্ট দেখুন`}
        </Button>
      ) : null}
    </div>
  );
}

/** লিড ডিটেইলে যাওয়ার লিংক — টেবিল থেকে সরাসরি ক্লায়েন্টের লেজারে পৌঁছানো যায় */
function ClientName({ row }: { row: ClientProfitRow }) {
  return (
    <Link
      href={`/sales/leads/${row.leadId}`}
      className="block truncate font-medium hover:underline"
    >
      {row.name}
    </Link>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate tabular-nums">{value}</dd>
    </div>
  );
}

function SortButton({
  label,
  active,
  direction,
  align = 'left',
  onClick,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  align?: 'left' | 'right';
  onClick: () => void;
}) {
  const Icon = !active ? ChevronsUpDown : direction === 'asc' ? ArrowUp : ArrowDown;

  return (
    <button
      type="button"
      onClick={onClick}
      // aria-sort হেডার সেলে বসানো যেত, কিন্তু বাটনেই লেবেলটা পড়া হয় —
      // তাই স্ক্রিন-রিডারের জন্য অবস্থাটা এখানে বলা হচ্ছে
      aria-label={`${label} অনুযায়ী সাজান${active ? ` (এখন ${direction === 'asc' ? 'ছোট থেকে বড়' : 'বড় থেকে ছোট'})` : ''}`}
      className={cn(
        'inline-flex items-center gap-1 transition-colors hover:text-foreground',
        align === 'right' && 'flex-row-reverse',
        active && 'text-foreground',
      )}
    >
      <span>{label}</span>
      <Icon className={cn('h-3 w-3 shrink-0', !active && 'opacity-40')} aria-hidden />
    </button>
  );
}

/** মোবাইলে টেবিল-হেডার নেই, তাই সাজানোর কলামগুলো আলাদা চিপ হিসেবে */
function SortPicker({
  sort,
  direction,
  onToggle,
}: {
  sort: ClientProfitSort;
  direction: SortDirection;
  onToggle: (key: ClientProfitSort) => void;
}) {
  const options: { key: ClientProfitSort; label: string }[] = [
    { key: 'margin', label: 'মার্জিন' },
    { key: 'billed', label: 'বিল' },
    { key: 'cost', label: 'কস্ট' },
    { key: 'name', label: 'নাম' },
  ];

  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="সাজানোর ক্রম">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onToggle(option.key)}
          aria-pressed={sort === option.key}
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors',
            sort === option.key
              ? 'border-transparent bg-secondary font-medium text-secondary-foreground'
              : 'text-muted-foreground',
          )}
        >
          {option.label}
          {sort === option.key ? (
            direction === 'asc' ? (
              <ArrowUp className="h-3 w-3" aria-hidden />
            ) : (
              <ArrowDown className="h-3 w-3" aria-hidden />
            )
          ) : null}
        </button>
      ))}
    </div>
  );
}
