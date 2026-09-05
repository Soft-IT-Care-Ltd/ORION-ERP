'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Pencil, Receipt } from 'lucide-react';
import type { LeadStage } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { LEAD_STAGES, STAGE_LABEL } from '@/lib/leads';
import { changeLeadStage } from '../actions';
import {
  LeadFormDialog,
  type EditableLead,
  type ExecutiveOption,
  type UnitOption,
} from '../lead-form-dialog';
import { LostReasonDialog } from '../lost-reason-dialog';
import { WonSaleDialog, type SaleUnitOption } from '../won-sale-dialog';

export function LeadDetailActions({
  lead,
  stage,
  leadName,
  executives,
  units,
  saleUnits,
  canAssign,
  canEdit,
  canConvert,
  hasSale,
}: {
  lead: EditableLead;
  stage: LeadStage;
  leadName: string;
  executives: ExecutiveOption[];
  units: UnitOption[];
  saleUnits: SaleUnitOption[];
  canAssign: boolean;
  canEdit: boolean;
  /** Won → সেল কনভার্শনের অনুমতি (`lead:convert`) */
  canConvert: boolean;
  /** সেল তৈরি হয়ে গেছে — স্টেজ আর বদলানো যাবে না */
  hasSale: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<LeadStage>(stage);
  const [pending, setPending] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
  const [wonOpen, setWonOpen] = useState(false);

  // server refresh এর পর প্রকৃত স্টেজই দেখাবে
  useEffect(() => setSelected(stage), [stage]);

  async function save(next: LeadStage, lostReason?: string) {
    setPending(true);
    const result = await changeLeadStage({ id: lead.id, stage: next, lostReason });
    setPending(false);

    if (!result.ok) {
      setSelected(stage);
      toast.error(result.message);
      return false;
    }

    toast.success(result.message);
    router.refresh();
    return true;
  }

  function onStagePick(next: LeadStage) {
    if (next === stage) return;
    setSelected(next);
    // PRD সেকশন ৫.১ — Lost এ কারণ ছাড়া যাওয়া যাবে না
    if (next === 'LOST') {
      setLostOpen(true);
      return;
    }
    // PRD সেকশন ৫.১ — Won মানে সেল কনভার্শন (ইউনিট + মূল্য নিশ্চিত করতে হবে)
    if (next === 'WON') {
      if (!canConvert) {
        setSelected(stage);
        toast.error('Won এ নেওয়ার অনুমতি আপনার নেই');
        return;
      }
      setWonOpen(true);
      return;
    }
    void save(next);
  }

  if (!canEdit) return null;

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <Label htmlFor="detail-stage" className="text-xs text-muted-foreground">
          স্টেজ
        </Label>
        <div className="flex items-center gap-2">
          <NativeSelect
            id="detail-stage"
            value={selected}
            disabled={pending || hasSale}
            onChange={(event) => onStagePick(event.target.value as LeadStage)}
            className="w-52"
          >
            {LEAD_STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABEL[s]}
              </option>
            ))}
          </NativeSelect>
          {pending ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
        </div>
        {hasSale ? (
          <p className="text-xs text-muted-foreground">সেল তৈরি হয়েছে — স্টেজ পরিবর্তন করা যাবে না</p>
        ) : null}
      </div>

      {/* Won এ আছে অথচ সেল তৈরি হয়নি (যেমন পুরনো ডেটা) — এখান থেকেই সেরে নেওয়া যায় */}
      {stage === 'WON' && !hasSale && canConvert ? (
        <Button onClick={() => setWonOpen(true)}>
          <Receipt className="mr-2 h-4 w-4" />
          সেল কনফার্ম করুন
        </Button>
      ) : null}

      <Button variant="outline" onClick={() => setEditOpen(true)}>
        <Pencil className="mr-2 h-4 w-4" />
        এডিট
      </Button>

      <LeadFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        lead={lead}
        executives={executives}
        units={units}
        canAssign={canAssign}
      />

      <WonSaleDialog
        open={wonOpen}
        onOpenChange={(open) => {
          setWonOpen(open);
          // বাতিল করলে ড্রপডাউন আগের স্টেজে ফিরে যাবে
          if (!open) setSelected(stage);
        }}
        lead={{ id: lead.id, name: leadName, email: lead.email, unitId: lead.unitId }}
        units={saleUnits}
      />

      <LostReasonDialog
        open={lostOpen}
        onOpenChange={(open) => {
          setLostOpen(open);
          // বাতিল করলে ড্রপডাউন আগের স্টেজে ফিরে যাবে
          if (!open) setSelected(stage);
        }}
        leadName={leadName}
        pending={pending}
        onConfirm={async (reason) => {
          const ok = await save('LOST', reason);
          if (ok) setLostOpen(false);
        }}
      />
    </div>
  );
}
