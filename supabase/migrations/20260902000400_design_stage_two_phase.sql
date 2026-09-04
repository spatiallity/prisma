-- ============================================================================
-- Design team owns two phases now, not one six-step chain:
--   Desain Siteplan:   Pembuatan Desain Awal -> Review Desain Awal ->
--                       Revisi Desain Awal -> Pembuatan Peta Inventaris dan
--                       Stake Out -> Finish
--   Finalisasi Desain: Pembuatan -> Review internal -> Sinkronisasi ->
--                       Submit Peta
-- Only 2 of the old 6 values (Desain Awal, Review) are ever actually in use
-- on a row; the other 4 (Pemaparan, Revisi, Finalisasi, Approved) have zero
-- rows on this project, so the CASE mapping below is a safety net for
-- whatever data exists, not a real historical migration.
-- ============================================================================

drop view v_bottleneck;

create type design_stage_v2 as enum (
  'Pembuatan Desain Awal',
  'Review Desain Awal',
  'Revisi Desain Awal',
  'Pembuatan Peta Inventaris dan Stake Out',
  'Finish',
  'Pembuatan',
  'Review internal',
  'Sinkronisasi',
  'Submit Peta'
);

alter table designs
  alter column current_stage drop default;
alter table designs
  alter column current_stage type design_stage_v2
  using (case current_stage::text
    when 'Desain Awal' then 'Pembuatan Desain Awal'
    when 'Review'      then 'Review Desain Awal'
    when 'Pemaparan'   then 'Revisi Desain Awal'
    when 'Revisi'      then 'Revisi Desain Awal'
    when 'Finalisasi'  then 'Pembuatan'
    when 'Approved'    then 'Submit Peta'
  end)::design_stage_v2;
alter table designs
  alter column current_stage set default 'Pembuatan Desain Awal'::design_stage_v2;

alter table design_revisions
  alter column stage type design_stage_v2
  using (case stage::text
    when 'Desain Awal' then 'Pembuatan Desain Awal'
    when 'Review'      then 'Review Desain Awal'
    when 'Pemaparan'   then 'Revisi Desain Awal'
    when 'Revisi'      then 'Revisi Desain Awal'
    when 'Finalisasi'  then 'Pembuatan'
    when 'Approved'    then 'Submit Peta'
  end)::design_stage_v2;

drop type design_stage;
alter type design_stage_v2 rename to design_stage;

-- Trigger's own fallback default (new design with no revision yet).
create or replace function refresh_design_current_stage()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $fn$
declare
  v_design uuid;
  v_stage  design_stage;
begin
  if tg_op = 'DELETE' then
    v_design := old.design_id;
  else
    v_design := new.design_id;
  end if;

  select dr.stage into v_stage
  from design_revisions dr
  where dr.design_id = v_design
    and dr.status = 'Active'
  order by dr.revision_no desc, dr.created_at desc
  limit 1;

  update designs
  set current_stage = coalesce(v_stage, 'Pembuatan Desain Awal'),
      updated_at    = now()
  where id = v_design;

  return null;
end;
$fn$;

comment on table designs is
  'Section 21 — two phases: Desain Siteplan (Pembuatan Desain Awal .. Finish),
   then Finalisasi Desain (Pembuatan .. Submit Peta).';

-- Recreate v_bottleneck: "waiting on someone" set now spans both phases'
-- review/revisi-shaped stages; "design finished" is the new terminal stage.
create view v_bottleneck
with (security_invoker = true) as
select 'operational' as area, 'SPK belum memiliki jadwal' as reason,
       s.id as spk_id, s.spk_number, 'warning'::notification_severity as severity, null::numeric as metric, s.site_code
from spks s
where s.status = 'On Going'
  and not exists (select 1 from daily_plans p where p.spk_id = s.id and p.status = 'Active')
union all
select 'operational', 'SPK belum memiliki Vendor Jasa Survey',
       s.id, s.spk_number, 'warning', null, s.site_code
from spks s
where s.status = 'On Going'
  and s.vendor_id is null
  and not exists (select 1 from spk_assignments a where a.spk_id = s.id and a.status = 'Active')
union all
select 'operational', 'Vendor Jasa Survey terlambat update',
       s.id, s.spk_number, 'warning',
       current_date - max(dp.progress_date), s.site_code
from spks s
join daily_progress dp on dp.spk_id = s.id and dp.status = 'Active'
where s.status = 'On Going'
group by s.id, s.spk_number, s.site_code
having current_date - max(dp.progress_date) > setting_number('vendor_update_late_days', 2)
union all
select 'design', 'Design menunggu review/revisi terlalu lama',
       d.spk_id, s.spk_number, 'warning',
       round(extract(epoch from (now() - d.updated_at)) / 86400.0, 2), s.site_code
from designs d
join spks s on s.id = d.spk_id
where d.status = 'Active'
  and d.current_stage in ('Review Desain Awal', 'Revisi Desain Awal', 'Review internal')
  and extract(epoch from (now() - d.updated_at)) / 86400.0
      > setting_number('design_stage_max_days', 7)
union all
select 'routing', 'Routing stage melewati lead time',
       lt.spk_id, s.spk_number, 'critical', lt.elapsed_days, s.site_code
from v_routing_lead_time lt
join spks s on s.id = lt.spk_id
where lt.is_overdue
  and lt.status in ('Pending', 'In Progress')
union all
select 'financial', 'Opname belum masuk', s.id, s.spk_number, 'warning', null, s.site_code
from spks s
where s.status in ('On Going', 'Selesai')
  and not exists (select 1 from opnames o where o.spk_id = s.id and o.status <> 'Cancelled')
  and (
    not exists (select 1 from designs d where d.spk_id = s.id and d.status = 'Active')
    or exists (
      select 1 from designs d
      where d.spk_id = s.id and d.status = 'Active' and d.current_stage = 'Submit Peta'
    )
  )
union all
select 'financial', 'PAD belum dibuat', s.id, s.spk_number, 'warning', null, s.site_code
from spks s
join opnames o on o.spk_id = s.id and o.status <> 'Cancelled'
where not exists (select 1 from pad p where p.spk_id = s.id and p.status <> 'Cancelled')
group by s.id, s.spk_number, s.site_code
union all
select 'financial', 'Invoice belum dibuat', s.id, s.spk_number, 'warning', null, s.site_code
from spks s
join pad p on p.spk_id = s.id and p.status <> 'Cancelled'
where not exists (select 1 from invoices i where i.spk_id = s.id and i.status <> 'Cancelled')
group by s.id, s.spk_number, s.site_code
union all
select 'financial', 'Payment belum diterima', f.spk_id, f.spk_number, 'warning', f.outstanding_payment, s.site_code
from v_spk_financial f
join spks s on s.id = f.spk_id
where f.invoice_total > 0 and f.outstanding_payment > 0;

comment on view v_bottleneck is
  'Section 9 — every bottleneck condition in one place, thresholds from app_settings.';
