-- Expense date remains in tanggal (and drives the RAB month). Reconciliation
-- is a separate event; historical rows have no known reconciliation date.
alter table public.finance_transactions
  add column tanggal_perjab date;

comment on column public.finance_transactions.tanggal is
  'Tanggal pengeluaran; the bulan bucket for RAB is derived from this date for new transactions.';
comment on column public.finance_transactions.tanggal_perjab is
  'Tanggal pertanggungjawaban, when recorded. Null for historical or pending transactions.';
