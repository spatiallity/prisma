-- Monitoring RAB's "Pengeluaran per bulan" chart and month list were built
-- client-side from an unfiltered, unordered finance_transactions fetch
-- (1048 Active rows and counting) — Supabase/PostgREST caps unbounded
-- selects at 1000 rows, so that fetch was silently missing ~48 rows with
-- no guarantee which month(s) they belonged to, undercounting whichever
-- month lost rows (September 2026 in practice). This view sums jumlah
-- per bulan in Postgres directly, so the chart reads a complete total per
-- month regardless of how large finance_transactions grows.
create view v_finance_realisasi_bulanan_total as
select bulan, sum(jumlah) as realisasi
from finance_transactions
where status = 'Active'
group by bulan;

alter view v_finance_realisasi_bulanan_total set (security_invoker = true);

comment on view v_finance_realisasi_bulanan_total is
  'Total realisasi per bulan across every kode_akun — backs Monitoring RAB''s monthly chart and month picker without relying on an unbounded row fetch.';
