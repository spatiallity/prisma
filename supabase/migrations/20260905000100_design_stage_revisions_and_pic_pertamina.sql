-- ============================================================================
-- 0019 — Design gets the same review shape as routing: a stage collects
--        revision rounds (what needs fixing, when it comes back) without
--        leaving the stage, and every stage entry records who reviewed it on
--        the Pertamina side.
-- ============================================================================

alter table design_revisions
  add column pic_pertamina text;

comment on column design_revisions.pic_pertamina is
  'Who reviews this stage on the Pertamina side — free text, mirrors routing_history.pic_name.';

-- ---------------------------------------------------------------------------
create table design_stage_revisions (
  id                 uuid primary key default gen_random_uuid(),
  design_revision_id uuid not null references design_revisions(id),
  note               text not null,
  resubmit_at        date not null,
  created_by         uuid references users(id),
  created_at         timestamptz not null default now()
);

comment on table design_stage_revisions is
  'One row per revision round on a design stage: what needs fixing and when it will be resubmitted.';

create index design_stage_revisions_stage_idx
  on design_stage_revisions(design_revision_id);

alter table design_stage_revisions enable row level security;

create policy design_stage_revisions_select on design_stage_revisions
  for select to authenticated
  using (
    has_perm('design', 'view')
    and exists (
      select 1 from design_revisions dr
      join designs d on d.id = dr.design_id
      where dr.id = design_revision_id and spk_visible(d.spk_id)
    )
  );

create policy design_stage_revisions_insert on design_stage_revisions
  for insert to authenticated
  with check (
    exists (
      select 1 from design_revisions dr
      join designs d on d.id = dr.design_id
      where dr.id = design_revision_id and spk_editable(d.spk_id, 'design')
    )
  );
