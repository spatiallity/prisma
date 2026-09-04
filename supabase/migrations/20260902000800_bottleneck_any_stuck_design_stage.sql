-- ============================================================================
-- "Design menunggu review/revisi terlalu lama" only fired for 3 of the 9
-- stages. A design stuck in ANY stage — including ones nobody is actively
-- reviewing, like "Pembuatan" — for a week is just as much a bottleneck.
-- Widened to every non-terminal stage; Submit Peta is excluded because it
-- IS the finished state (see 20260902000300_bottleneck_site_code_and_opname_gate.sql).
-- ============================================================================

drop view v_bottleneck;

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
select 'design', 'Design tidak berubah status lebih dari seminggu',
       d.spk_id, s.spk_number, 'warning',
       round(extract(epoch from (now() - d.updated_at)) / 86400.0, 2), s.site_code
from designs d
join spks s on s.id = d.spk_id
where d.status = 'Active'
  and d.current_stage <> 'Submit Peta'
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
