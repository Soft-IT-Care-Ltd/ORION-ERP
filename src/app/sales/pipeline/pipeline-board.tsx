'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import type { LeadStage } from '@prisma/client';
import { LEAD_STAGES, STAGE_LABEL } from '@/lib/leads';
import { validate } from '@/lib/validations/form';
import { changeStageSchema } from '@/lib/validations/lead-base';
import { changeLeadStage } from '../leads/actions';
import {
  LeadFormDialog,
  type EditableLead,
  type ExecutiveOption,
} from '../leads/lead-form-dialog';
import { LostReasonDialog } from '../leads/lost-reason-dialog';
import { WonProjectDialog } from '../leads/won-project-dialog';
import { LeadCard, LeadCardPreview } from './lead-card';
import { PipelineColumn } from './pipeline-column';
import type { PipelineLead } from './types';

export function PipelineBoard({
  leads,
  canEdit,
  canAssign,
  canConvert,
  executives,
}: {
  leads: PipelineLead[];
  canEdit: boolean;
  canAssign: boolean;
  /** Won → প্রজেক্ট কনভার্শনের অনুমতি (`lead:convert`) */
  canConvert: boolean;
  executives: ExecutiveOption[];
}) {
  const router = useRouter();

  // server থেকে আসা লিস্টের local কপি — drop এর সাথে সাথে কার্ড সরে যায় (optimistic),
  // server action ব্যর্থ হলে আগের অবস্থায় ফিরে যায়
  const [items, setItems] = useState(leads);
  useEffect(() => setItems(leads), [leads]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditableLead | null>(null);
  const [pendingLost, setPendingLost] = useState<PipelineLead | null>(null);
  const [pendingWon, setPendingWon] = useState<PipelineLead | null>(null);

  const sensors = useSensors(
    // ছোট নড়াচড়া = ক্লিক, তাই ৬px পেরোলে তবেই drag শুরু
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // মোবাইলে চাপ ধরে রাখলে drag; সাথে সাথে টানলে বোর্ড স্ক্রল হবে
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const byStage = useMemo(() => {
    const map = new Map<LeadStage, PipelineLead[]>(
      LEAD_STAGES.map((s) => [s, []] as [LeadStage, PipelineLead[]]),
    );
    for (const lead of items) map.get(lead.stage)?.push(lead);
    return map;
  }, [items]);

  const activeLead = activeId ? items.find((l) => l.id === activeId) ?? null : null;

  const applyStageChange = useCallback(
    async (lead: PipelineLead, stage: LeadStage, lostReason?: string) => {
      // PRD সেকশন ৫.১ — Lost এ কারণ বাধ্যতামূলক; কার্ড সরানোর আগেই ধরা পড়ে,
      // নইলে optimistic move টি করে আবার ফেরত নিতে হতো
      const check = validate(changeStageSchema, { id: lead.id, stage, lostReason });
      if (!check.ok) {
        toast.error(Object.values(check.fieldErrors)[0] ?? check.message);
        return false;
      }

      const snapshot = items;

      setItems((current) =>
        current.map((l) =>
          l.id === lead.id
            ? { ...l, stage, lostReason: stage === 'LOST' ? lostReason ?? l.lostReason : null }
            : l,
        ),
      );
      setSavingId(lead.id);

      const result = await changeLeadStage({ id: lead.id, stage, lostReason });

      setSavingId(null);
      if (!result.ok) {
        setItems(snapshot);
        toast.error(result.message);
        return false;
      }

      toast.success(result.message);
      router.refresh();
      return true;
    },
    [items, router],
  );

  const requestStageChange = useCallback(
    (lead: PipelineLead, stage: LeadStage) => {
      if (lead.stage === stage) return;
      // PRD সেকশন ৫.১ — Lost এ কারণ ছাড়া যাওয়া যাবে না
      if (stage === 'LOST') {
        setPendingLost(lead);
        return;
      }
      // PRD সেকশন ৫.৩ — Won মানে প্রজেক্ট তৈরি: কন্ট্রাক্ট ভ্যালু নিশ্চিত করে তবেই স্টেজ বদলায়
      if (stage === 'WON' && !lead.project) {
        if (!canConvert) {
          toast.error('Won এ নেওয়ার অনুমতি আপনার নেই');
          return;
        }
        setPendingWon(lead);
        return;
      }
      void applyStageChange(lead, stage);
    },
    [applyStageChange, canConvert],
  );

  /** screen-reader announcement এ id নয়, পড়ার মতো নাম দরকার */
  const leadName = (id: string | number) =>
    items.find((l) => l.id === String(id))?.name ?? 'লিড';
  const stageName = (id: string | number) => STAGE_LABEL[String(id) as LeadStage] ?? String(id);

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const lead = items.find((l) => l.id === String(active.id));
    // droppable id গুলোই stage — column ছাড়া অন্য কিছু droppable নয়
    const stage = String(over.id) as LeadStage;
    if (!lead || !LEAD_STAGES.includes(stage)) return;

    requestStageChange(lead, stage);
  }

  return (
    <>
      <DndContext
        // স্থির id — না দিলে dnd-kit এর auto-generated `aria-describedby` server ও
        // client এ আলাদা হয়ে hydration mismatch warning দেয়
        id="lead-pipeline"
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
        accessibility={{
          announcements: {
            onDragStart: ({ active }) => `${leadName(active.id)} টেনে নেওয়া শুরু হয়েছে`,
            onDragOver: ({ over }) =>
              over ? `${stageName(over.id)} কলামের উপরে` : 'কোনো কলামের উপরে নয়',
            onDragEnd: ({ active, over }) =>
              over
                ? `${leadName(active.id)} — ${stageName(over.id)} এ ছাড়া হয়েছে`
                : 'বাতিল হয়েছে',
            onDragCancel: () => 'বাতিল হয়েছে',
          },
        }}
      >
        {/* মোবাইলে কলামগুলো পাশাপাশি স্ক্রল হয় — bleed করে edge পর্যন্ত */}
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
          {LEAD_STAGES.map((stage) => {
            const columnLeads = byStage.get(stage) ?? [];
            return (
              <PipelineColumn key={stage} stage={stage} count={columnLeads.length}>
                {columnLeads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    canEdit={canEdit}
                    pending={savingId === lead.id}
                    canConvert={canConvert}
                    onEdit={(l) => setEditing(l.editable)}
                    onChangeStage={requestStageChange}
                    onConvert={setPendingWon}
                  />
                ))}
              </PipelineColumn>
            );
          })}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeLead ? <LeadCardPreview lead={activeLead} /> : null}
        </DragOverlay>
      </DndContext>

      <LostReasonDialog
        open={pendingLost !== null}
        onOpenChange={(open) => {
          if (!open) setPendingLost(null);
        }}
        leadName={pendingLost?.name ?? ''}
        pending={savingId !== null}
        onConfirm={async (reason) => {
          if (!pendingLost) return;
          const ok = await applyStageChange(pendingLost, 'LOST', reason);
          if (ok) setPendingLost(null);
        }}
      />

      <WonProjectDialog
        open={pendingWon !== null}
        onOpenChange={(open) => {
          if (!open) setPendingWon(null);
        }}
        lead={
          pendingWon
            ? { id: pendingWon.id, name: pendingWon.name, email: pendingWon.editable.email }
            : null
        }
        onConverted={() => setPendingWon(null)}
      />

      {editing ? (
        <LeadFormDialog
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          lead={editing}
          executives={executives}
          canAssign={canAssign}
        />
      ) : null}
    </>
  );
}
