-- spk_pad now counts SPKs marked PAD (spks.pad_marked_at), not rows in the
-- retired pad table (migration 0018 turned PAD into a mark, not a document).
create or replace view v_dashboard_kpi
with (security_invoker = true) as
select
  (select count(*) from spks where status <> 'Cancelled')                     as total_spk,
  (select count(*) from spks where status = 'On Going')                       as spk_on_going,
  (select count(*) from spks where status = 'Selesai')                        as spk_selesai,
  (select count(distinct spk_id) from spk_routing)                            as spk_routing,
  (select count(*) from spks where pad_marked_at is not null)                 as spk_pad,
  (select count(distinct spk_id) from invoices where status <> 'Cancelled')   as spk_invoice,
  (select count(distinct spk_id) from payments where status <> 'Cancelled')   as spk_payment;

comment on view v_dashboard_kpi is 'Section 8.1 — all counts derived, never typed.';
