-- ============================================================================
-- Whether a UMK cash advance has been reconciled (pertanggungjawaban) yet.
-- Same scoping as pj_nama — 'umk' kategori only, null for the other five.
-- ============================================================================

alter table finance_transactions
  add column perjab text check (perjab in ('Belum', 'Sudah'));
