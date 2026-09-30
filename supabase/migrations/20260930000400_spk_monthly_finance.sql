-- Monthly comparison of realized opname, issued SPKs, and all active expenses.
-- Expense uses the RAB month bucket because historical entries may not have
-- an individual transaction date. Draft SPKs are not yet issued.
create view public.v_spk_monthly_finance with (security_invoker = true) as
with issued_spks as (
  select date_trunc('month', start_date)::date as bulan,
         count(*) as jumlah_spk,
         sum(coalesce(contract_value, 0)) as nilai_spk
  from public.spks
  where status in ('On Going', 'Selesai')
    and start_date is not null
  group by 1
), opname as (
  select date_trunc('month', opname_marked_at at time zone 'Asia/Jakarta')::date as bulan,
         count(*) as jumlah_opname,
         sum(coalesce(opname_value, 0)) as pendapatan
  from public.spks
  where opname_marked_at is not null
  group by 1
), expenses as (
  select bulan, sum(jumlah) as pengeluaran
  from public.finance_transactions
  where status = 'Active'
  group by bulan
), months as (
  select bulan from issued_spks
  union
  select bulan from opname
  union
  select bulan from expenses
)
select months.bulan,
       coalesce(opname.pendapatan, 0) as pendapatan,
       coalesce(issued_spks.nilai_spk, 0) as nilai_spk,
       coalesce(expenses.pengeluaran, 0) as pengeluaran,
       coalesce(opname.jumlah_opname, 0) as jumlah_opname,
       coalesce(issued_spks.jumlah_spk, 0) as jumlah_spk
from months
left join opname using (bulan)
left join issued_spks using (bulan)
left join expenses using (bulan);

revoke all on public.v_spk_monthly_finance from anon;
grant select on public.v_spk_monthly_finance to authenticated;

comment on view public.v_spk_monthly_finance is
  'Opname by local mark month, issued SPK value by start month (Draft excluded), and all active expense categories by RAB month. Invoker permissions preserve source-table RLS.';
