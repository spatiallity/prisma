-- ============================================================================
-- 0011 — Derived numbers (Section 4.3, 15, 20, 24, 26, 8, 9)
--
-- Every figure the dashboard shows is computed here. Nothing in this file is
-- ever written by a user. All views are security_invoker so the caller's RLS
-- still applies — without it a view would silently hand vendor accounts the
-- financial data Section 31 forbids.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Tunable thresholds (Risiko 1 — configuration, not hard-coded values)
-- ---------------------------------------------------------------------------
create table app_settings (
  key         text primary key,
  value       text not null,
  value_type  text not null default 'number' check (value_type in ('number', 'text', 'boolean')),
  description text,
  updated_by  uuid references users(id),
  updated_at  timestamptz not null default now()
);

create trigger app_settings_set_updated_at
  before update on app_settings
  for each row execute function set_updated_at();

create or replace function setting_number(p_key text, p_default numeric)
returns numeric
language sql
stable
security definer
set search_path = public, pg_catalog
as $fn$
  select coalesce((select value::numeric from app_settings where key = p_key), p_default);
$fn$;

grant execute on function setting_number(text, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- Cash ledger running balance (Section 25.6.1)
-- ---------------------------------------------------------------------------
create view v_cash_ledger
with (security_invoker = true) as
select
  cl.*,
  sum(cl.amount_in - cl.amount_out) over (
    order by cl.entry_date, cl.created_at, cl.id
    rows between unbounded preceding and current row
  ) as balance
from cash_ledger cl
where cl.status = 'Active';

comment on view v_cash_ledger is
  'Section 25.6.1 — saldo = saldo sebelumnya + uang masuk - uang keluar, computed.';

create view v_cash_balance
with (security_invoker = true) as
select
  coalesce(sum(amount_in - amount_out), 0) as balance,
  coalesce(sum(amount_in), 0)  as total_in,
  coalesce(sum(amount_out), 0) as total_out,
  max(entry_date) as last_entry_date
from cash_ledger
where status = 'Active';

-- ---------------------------------------------------------------------------
-- Progress (Section 15)
-- ---------------------------------------------------------------------------
create view v_spk_activity_progress
with (security_invoker = true) as
select
  a.id            as spk_activity_id,
  a.spk_id,
  a.name,
  a.sequence,
  a.measurement,
  a.unit,
  a.weight,
  a.target_value,
  a.current_value,
  a.current_stage,
  a.progress_percent,
  round(a.progress_percent * a.weight / 100.0, 3) as contribution_percent
from spk_activities a;

comment on view v_spk_activity_progress is
  'Section 15 — Activity Contribution = Activity Progress x Activity Weight.';

create view v_spk_progress
with (security_invoker = true) as
select
  s.id as spk_id,
  s.spk_number,
  s.site_code,
  s.work_name,
  s.status,
  s.start_date,
  s.end_date,
  coalesce(sum(round(a.progress_percent * a.weight / 100.0, 3)), 0) as overall_progress,
  coalesce(sum(a.weight), 0) as total_weight,
  count(a.id) as activity_count,
  count(a.id) filter (where a.progress_percent >= 100) as activity_completed
from spks s
left join spk_activities a on a.spk_id = s.id
group by s.id;

comment on view v_spk_progress is
  'Section 15 — Overall Progress = sum of activity contributions. Never entered by hand.';

-- ---------------------------------------------------------------------------
-- Productivity (Section 20)
-- ---------------------------------------------------------------------------
create view v_productivity
with (security_invoker = true) as
select
  dp.spk_id,
  dp.vendor_id,
  dp.team_id,
  dp.spk_activity_id,
  a.name as activity_name,
  a.unit,
  count(distinct dp.progress_date)                        as working_days,
  sum(dp.actual_value)                                    as total_actual,
  round(sum(dp.actual_value) / nullif(count(distinct dp.progress_date), 0), 3)
                                                          as per_day
from daily_progress dp
left join spk_activities a on a.id = dp.spk_activity_id
where dp.status = 'Active'
group by dp.spk_id, dp.vendor_id, dp.team_id, dp.spk_activity_id, a.name, a.unit;

comment on view v_productivity is
  'Section 20 — e.g. Terestris 1,8 Ha/day, Stake Out 15 patok/day.';

-- Plan vs actual per day (Section 18)
create view v_plan_vs_actual
with (security_invoker = true) as
select
  p.id            as daily_plan_id,
  p.spk_id,
  p.plan_date,
  p.vendor_id,
  p.team_id,
  p.spk_activity_id,
  p.target_value,
  coalesce(sum(dp.actual_value), 0) as actual_value,
  ratio_to_percent(coalesce(sum(dp.actual_value), 0), p.target_value) as achievement_percent
from daily_plans p
left join daily_progress dp
  on dp.daily_plan_id = p.id
 and dp.status = 'Active'
where p.status = 'Active'
group by p.id;

-- Today's Schedule (Section 10)
create view v_today_schedule
with (security_invoker = true) as
select
  p.id as daily_plan_id,
  p.spk_id,
  s.spk_number,
  s.site_code,
  p.vendor_id,
  v.name as vendor_name,
  p.team_id,
  t.name as team_name,
  p.spk_activity_id,
  a.name as activity_name,
  p.target_value,
  p.unit,
  case
    when exists (
      select 1 from daily_progress dp
      where dp.daily_plan_id = p.id
        and dp.status = 'Active'
        and dp.progress_date = p.plan_date
    ) then 'Updated Today'::daily_update_status
    when p.plan_date < current_date then 'Terlambat Update'::daily_update_status
    else 'Belum Update'::daily_update_status
  end as update_status
from daily_plans p
join spks s on s.id = p.spk_id
left join vendors v on v.id = p.vendor_id
left join vendor_teams t on t.id = p.team_id
left join spk_activities a on a.id = p.spk_activity_id
where p.status = 'Active'
  and p.plan_date = current_date;

-- ---------------------------------------------------------------------------
-- Routing lead time (Section 24)
-- ---------------------------------------------------------------------------
create view v_routing_lead_time
with (security_invoker = true) as
select
  rh.id as routing_history_id,
  r.spk_id,
  r.id  as spk_routing_id,
  r.document_type,
  rh.step_name,
  rh.sequence,
  rh.status,
  rh.started_at,
  rh.completed_at,
  rh.duration_days,
  rh.sla_days,
  case
    when rh.completed_at is null and rh.started_at is not null
      then round(extract(epoch from (now() - rh.started_at)) / 86400.0, 2)
    else rh.duration_days
  end as elapsed_days,
  case
    when rh.sla_days is null then false
    when rh.completed_at is null and rh.started_at is not null
      then extract(epoch from (now() - rh.started_at)) / 86400.0 > rh.sla_days
    else coalesce(rh.duration_days > rh.sla_days, false)
  end as is_overdue
from routing_history rh
join spk_routing r on r.id = rh.spk_routing_id;

create view v_routing_stage_average
with (security_invoker = true) as
select
  step_name,
  count(*) filter (where duration_days is not null) as completed_count,
  round(avg(duration_days), 2) as avg_duration_days,
  round(max(duration_days), 2) as max_duration_days
from routing_history
group by step_name;

-- ---------------------------------------------------------------------------
-- Financial reconciliation — revenue side (Section 26.1)
-- ---------------------------------------------------------------------------
create view v_spk_financial
with (security_invoker = true) as
select
  s.id as spk_id,
  s.spk_number,
  s.contract_value                                        as spk_contract_value,
  coalesce(c.contract_total, 0)                           as contract_total,
  coalesce(o.opname_total, 0)                             as opname_total,
  coalesce(pd.pad_total, 0)                               as pad_total,
  coalesce(i.invoice_total, 0)                            as invoice_total,
  coalesce(pm.payment_total, 0)                           as payment_total,
  coalesce(c.contract_total, 0) - coalesce(o.opname_total, 0)   as contract_vs_opname,
  coalesce(o.opname_total, 0)   - coalesce(i.invoice_total, 0)  as opname_vs_invoice,
  coalesce(i.invoice_total, 0)  - coalesce(pm.payment_total, 0) as outstanding_payment
from spks s
left join (
  select spk_id, sum(contract_value) as contract_total
  from contracts where status <> 'Cancelled' group by spk_id
) c on c.spk_id = s.id
left join (
  select spk_id, sum(opname_value) as opname_total
  from opnames where status <> 'Cancelled' group by spk_id
) o on o.spk_id = s.id
left join (
  select spk_id, sum(pad_value) as pad_total
  from pad where status <> 'Cancelled' group by spk_id
) pd on pd.spk_id = s.id
left join (
  select spk_id, sum(invoice_value) as invoice_total
  from invoices where status <> 'Cancelled' group by spk_id
) i on i.spk_id = s.id
left join (
  select spk_id, sum(payment_value) as payment_total
  from payments where status <> 'Cancelled' group by spk_id
) pm on pm.spk_id = s.id;

comment on view v_spk_financial is
  'Section 26.1 — Contract vs Opname vs Invoice vs Payment per SPK.';

-- ---------------------------------------------------------------------------
-- Cost and margin per SPK (Section 26.2)
-- ---------------------------------------------------------------------------
create view v_spk_cost
with (security_invoker = true) as
select
  s.id as spk_id,
  coalesce(vp.vendor_payable_total, 0)  as vendor_payable,
  coalesce(vp.vendor_paid_total, 0)     as vendor_paid,
  coalesce(pc.personnel_total, 0)       as personnel_cost,
  coalesce(cl.cash_total, 0)            as operational_cash,
  coalesce(vp.vendor_payable_total, 0)
    + coalesce(pc.personnel_total, 0)
    + coalesce(cl.cash_total, 0)        as total_cost
from spks s
left join (
  select spk_id,
         sum(vendor_payable) as vendor_payable_total,
         sum(amount_paid)    as vendor_paid_total
  from vendor_payments group by spk_id
) vp on vp.spk_id = s.id
left join (
  select spk_id, sum(amount) as personnel_total
  from personnel_costs where status = 'Active' and spk_id is not null group by spk_id
) pc on pc.spk_id = s.id
left join (
  select spk_id, sum(amount_out) as cash_total
  from cash_ledger where status = 'Active' and spk_id is not null group by spk_id
) cl on cl.spk_id = s.id;

comment on view v_spk_cost is
  'Section 26.2 — Total Cost = Vendor Payable + tagged Personnel Cost + tagged Operational Cash.';

create view v_spk_margin
with (security_invoker = true) as
select
  f.spk_id,
  f.spk_number,
  f.invoice_total,
  c.vendor_payable,
  c.personnel_cost,
  c.operational_cash,
  c.total_cost,
  f.invoice_total - c.total_cost as margin,
  case
    when f.invoice_total = 0 then null
    else round((f.invoice_total - c.total_cost) / f.invoice_total * 100, 2)
  end as margin_percent
from v_spk_financial f
join v_spk_cost c on c.spk_id = f.spk_id;

comment on view v_spk_margin is
  'Section 26.2 — Margin = Invoice Value - Total Cost per SPK. Computed, never entered.';

-- ---------------------------------------------------------------------------
-- Project overhead (Section 26.3) — costs deliberately NOT pushed into margin
-- ---------------------------------------------------------------------------
create view v_project_overhead_monthly
with (security_invoker = true) as
select
  period_month,
  sum(operational_cash) as operational_cash,
  sum(personnel_cost)   as personnel_cost,
  sum(operational_cash) + sum(personnel_cost) as overhead_total
from (
  select date_trunc('month', entry_date)::date as period_month,
         sum(amount_out) as operational_cash,
         0::numeric      as personnel_cost
  from cash_ledger
  where status = 'Active' and spk_id is null
  group by 1
  union all
  select date_trunc('month', period)::date as period_month,
         0::numeric      as operational_cash,
         sum(amount)     as personnel_cost
  from personnel_costs
  where status = 'Active' and spk_id is null
  group by 1
) x
group by period_month;

comment on view v_project_overhead_monthly is
  'Section 26.3 — untagged cash and personnel cost, kept separate from per-SPK margin.';

-- ---------------------------------------------------------------------------
-- Dashboard KPI (Section 8.1)
-- ---------------------------------------------------------------------------
create view v_dashboard_kpi
with (security_invoker = true) as
select
  (select count(*) from spks where status <> 'Cancelled')                     as total_spk,
  (select count(*) from spks where status = 'On Going')                       as spk_on_going,
  (select count(*) from spks where status = 'Selesai')                        as spk_selesai,
  (select count(distinct spk_id) from spk_routing)                            as spk_routing,
  (select count(distinct spk_id) from pad where status <> 'Cancelled')        as spk_pad,
  (select count(distinct spk_id) from invoices where status <> 'Cancelled')   as spk_invoice,
  (select count(distinct spk_id) from payments where status <> 'Cancelled')   as spk_payment;

comment on view v_dashboard_kpi is 'Section 8.1 — all counts derived, never typed.';

-- ---------------------------------------------------------------------------
-- Bottleneck detection (Section 9)
-- ---------------------------------------------------------------------------
create view v_bottleneck
with (security_invoker = true) as
-- Operational
select 'operational' as area, 'SPK belum memiliki jadwal' as reason,
       s.id as spk_id, s.spk_number, 'warning'::notification_severity as severity, null::numeric as metric
from spks s
where s.status = 'On Going'
  and not exists (select 1 from daily_plans p where p.spk_id = s.id and p.status = 'Active')
union all
select 'operational', 'SPK belum memiliki Vendor Jasa Survey',
       s.id, s.spk_number, 'warning', null
from spks s
where s.status = 'On Going'
  and s.vendor_id is null
  and not exists (select 1 from spk_assignments a where a.spk_id = s.id and a.status = 'Active')
union all
select 'operational', 'Vendor Jasa Survey terlambat update',
       s.id, s.spk_number, 'warning',
       current_date - max(dp.progress_date)
from spks s
join daily_progress dp on dp.spk_id = s.id and dp.status = 'Active'
where s.status = 'On Going'
group by s.id, s.spk_number
having current_date - max(dp.progress_date) > setting_number('vendor_update_late_days', 2)
union all
-- Design
select 'design', 'Design menunggu review/revisi terlalu lama',
       d.spk_id, s.spk_number, 'warning',
       round(extract(epoch from (now() - d.updated_at)) / 86400.0, 2)
from designs d
join spks s on s.id = d.spk_id
where d.status = 'Active'
  and d.current_stage in ('Review', 'Revisi', 'Finalisasi')
  and extract(epoch from (now() - d.updated_at)) / 86400.0
      > setting_number('design_stage_max_days', 7)
union all
-- Routing
select 'routing', 'Routing stage melewati lead time',
       lt.spk_id, s.spk_number, 'critical', lt.elapsed_days
from v_routing_lead_time lt
join spks s on s.id = lt.spk_id
where lt.is_overdue
  and lt.status in ('Pending', 'In Progress')
union all
-- Financial
select 'financial', 'Opname belum masuk', s.id, s.spk_number, 'warning', null
from spks s
where s.status in ('On Going', 'Selesai')
  and not exists (select 1 from opnames o where o.spk_id = s.id and o.status <> 'Cancelled')
union all
select 'financial', 'PAD belum dibuat', s.id, s.spk_number, 'warning', null
from spks s
join opnames o on o.spk_id = s.id and o.status <> 'Cancelled'
where not exists (select 1 from pad p where p.spk_id = s.id and p.status <> 'Cancelled')
group by s.id, s.spk_number
union all
select 'financial', 'Invoice belum dibuat', s.id, s.spk_number, 'warning', null
from spks s
join pad p on p.spk_id = s.id and p.status <> 'Cancelled'
where not exists (select 1 from invoices i where i.spk_id = s.id and i.status <> 'Cancelled')
group by s.id, s.spk_number
union all
select 'financial', 'Payment belum diterima', f.spk_id, f.spk_number, 'warning', f.outstanding_payment
from v_spk_financial f
where f.invoice_total > 0 and f.outstanding_payment > 0
union all
select 'financial', 'Vendor payment jatuh tempo belum dibayar',
       vp.spk_id, s.spk_number, 'critical', t.amount
from vendor_payment_terms t
join vendor_payments vp on vp.id = t.vendor_payment_id
join spks s on s.id = vp.spk_id
where t.status = 'Active'
  and t.paid_date is null
  and t.due_date is not null
  and t.due_date < current_date
union all
select 'financial', 'Saldo kas kecil di bawah threshold',
       null::uuid, null::text, 'critical', b.balance
from v_cash_balance b
where b.balance < setting_number('cash_balance_threshold', 5000000);

comment on view v_bottleneck is
  'Section 9 — every bottleneck condition in one place, thresholds from app_settings.';
