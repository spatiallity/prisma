-- ============================================================================
-- 0026 — Denda moves onto the SPK itself, same as Opname/PAD
-- ============================================================================

-- Contract penalty (denda), when there is one, read live in Financial Report
-- next to Opname/PAD/Invoice — no separate Contract document needed.
alter table spks add column denda_value numeric;
comment on column spks.denda_value is 'Denda kontrak, dikenakan saat invoice final — dibaca live di Financial Report, sama seperti opname_value/pad_value.';
