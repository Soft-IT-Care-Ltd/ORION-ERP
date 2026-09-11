'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { HardHat, Loader2, Pencil } from 'lucide-react';
import type { LeadStage } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { CONDITIONAL_STAGE_HINT, isConditionalStage, LEAD_STAGES, STAGE_LABEL } from '@/lib/leads';
import { validate } from '@/lib/validations/form';
import { changeStageSchema } from '@/lib/validations/lead-base';
import { changeLeadStage } from '../actions';
import { LeadFormDialog, type EditableLead, type ExecutiveOption } from '../lead-form-dialog';
import { LostReasonDialog } from '../lost-reason-dialog';
import { WonProjectDialog } from '../won-project-dialog';

export function LeadDetailActions({
  lead,
  stage,
  leadName,
  executives,
  canAssign,
  canEdit,
  canConvert,
  hasProject,
}: {
  lead: EditableLead;
  stage: LeadStage;
  leadName: string;
  executives: ExecutiveOption[];
  canAssign: boolean;
  canEdit: boolean;
  /** Won → প্রজেক্ট কনভার্শনের অনুমতি (`lead:convert`) */
  canConvert: boolean;
  /** প্রজেক্ট তৈরি হয়ে গেছে — স্টেজ আর বদলানো যাবে না */
  hasProject: boolean;
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
    const check = validate(changeStageSchema, { id: lead.id, stage: next, lostReason });
    if (!check.ok) {
      setSelected(stage);
      toast.error(Object.values(check.fieldErrors)[0] ?? check.message);
      return false;
    }

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
    // PRD সেকশন ৫.৩ — Won মানে প্রজেক্ট তৈরি (কন্ট্রাক্ট ভ্যালু নিশ্চিত করতে হবে)
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
            disabled={pending || hasProject}
            onChange={(event) => onStagePick(event.target.value as LeadStage)}
            className="w-52"
          >
            {LEAD_STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABEL[s]}
                {isConditionalStage(s) ? ` (${CONDITIONAL_STAGE_HINT})` : ''}
              </option>
            ))}
          </NativeSelect>
          {pending ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
        </div>
        {hasProject ? (
          <p className="text-xs text-muted-foreground">
            প্রজেক্ট তৈরি হয়েছে — স্টেজ পরিবর্তন করা যাবে না
          </p>
        ) : null}
      </div>

      {/* Won এ আছে অথচ প্রজেক্ট তৈরি হয়নি (যেমন পুরনো ডেটা) — এখান থেকেই সেরে নেওয়া যায় */}
      {stage === 'WON' && !hasProject && canConvert ? (
        <Button onClick={() => setWonOpen(true)}>
          <HardHat className="mr-2 h-4 w-4" />
          প্রজেক্ট তৈরি করুন
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
        canAssign={canAssign}
      />

      <WonProjectDialog
        open={wonOpen}
        onOpenChange={(open) => {
          setWonOpen(open);
          // বাতিল করলে ড্রপডাউন আগের স্টেজে ফিরে যাবে
          if (!open) setSelected(stage);
        }}
        lead={{ id: lead.id, name: leadName, email: lead.email }}
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
