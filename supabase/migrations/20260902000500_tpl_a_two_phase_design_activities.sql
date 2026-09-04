-- ============================================================================
-- TPL-A: old single "Desain Siteplan" (17%) and "Finalisasi Desain" (8%) rows
-- replaced with 8 granular sub-activities matching the design module's new
-- two-phase stage list. Desain Siteplan splits evenly (17/4 = 4.25% each,
-- "Finish" carries no weight of its own — it's a terminal marker, not a
-- deliverable). Finalisasi Desain keeps the spreadsheet's weights except
-- Submit Peta, nudged from 1.48 to 1.44 so the four items sum to exactly
-- 8.000 (the spreadsheet's own numbers summed to 8.04, which would have
-- pushed TPL-A's total past the 100% ceiling the weight-sum trigger enforces).
-- Existing SPKs keep their already-instantiated single-row activities — a
-- template change never rewrites an SPK already in flight, same principle as
-- routing SLA edits.
-- ============================================================================

-- Make room after "Pengolahan Data Topo" (sequence 5) for 8 new rows before
-- "Stake Out" (old sequence 6).
update activity_template_items
set sequence = sequence + 6
where template_id = (select id from activity_templates where code = 'TPL-A')
  and sequence >= 6;

-- Existing SPKs' already-instantiated activities lose their template_item_id
-- link (not the row itself) so the FK doesn't block deleting the old items.
update spk_activities
set template_item_id = null
where template_item_id in (
  select id from activity_template_items
  where template_id = (select id from activity_templates where code = 'TPL-A')
    and name in ('Desain Siteplan', 'Finalisasi Desain')
);

delete from activity_template_items
where template_id = (select id from activity_templates where code = 'TPL-A')
  and name in ('Desain Siteplan', 'Finalisasi Desain');

insert into activity_template_items
  (template_id, name, weight, measurement, unit, sequence, target_from_spk_area)
select
  (select id from activity_templates where code = 'TPL-A'),
  name, weight, 'stage', null, sequence, false
from (values
  ('Pembuatan Desain Awal', 4.25, 6),
  ('Review Desain Awal', 4.25, 7),
  ('Revisi Desain Awal', 4.25, 8),
  ('Pembuatan Peta Inventaris dan Stake Out', 4.25, 9),
  ('Pembuatan', 2.64, 10),
  ('Review internal', 1.28, 11),
  ('Sinkronisasi', 2.64, 12),
  ('Submit Peta', 1.44, 13)
) as t(name, weight, sequence);
