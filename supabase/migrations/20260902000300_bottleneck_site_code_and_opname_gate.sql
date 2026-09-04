-- ============================================================================
-- 1. Show site_code (BNG-A7) instead of spk_number as the SPK label —
--    spk_number is an internal document number, site_code is what the field
--    actually recognizes. Added to every row of v_bottleneck (appended at
--    the end — CREATE OR REPLACE VIEW can't splice a column into the
--    middle of an existing column list).
-- 2. "Opname belum masuk" should only fire once design work is finished —
--    opname happens after the design is Approved, not from day one. SPK
--    with no active design record at all (Tanpa Desain Siteplan / Stake
--    Out work) keep the old behavior, since there's no design phase to
--    wait for.
--
-- Rebuilt from the *live* view's actual definition (pg_get_viewdef), not
-- from 20260825001100_derived_views.sql's original v_bottleneck: that
-- file's "Vendor payment jatuh tempo" / "Saldo kas kecil" branches
-- reference vendor_payment_terms / vendor_payments / v_cash_balance, none
-- of which exist on this project — that part of 20260825000900_spending.sql
-- never actually got applied here, so the live view was built without
-- those branches. This migration preserves that (pre-existing, unrelated)
-- gap rather than trying to silently fix it.
-- ============================================================================

create or replace view v_bottleneck
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
  and d.current_stage in ('Review', 'Revisi', 'Finalisasi')
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
      where d.spk_id = s.id and d.status = 'Active' and d.current_stage = 'Approved'
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
