-- ============================================================================
-- 0021 — Two v_bottleneck branches went stale after migration 0020 split
-- Desain Siteplan and Finalisasi Desain into separate records:
--
-- 1. "Design tidak berubah status lebih dari seminggu" only excluded
--    'Submit Peta' from the stale check. Under the new model a siteplan
--    record's own terminal stage is 'Finish', which never advances any
--    further once reached (the finalisasi record picks up from there as a
--    separate row) — so every finished Desain Siteplan would start flagging
--    itself as stuck after a week and never stop. 'Finish' now excludes the
--    same way 'Submit Peta' already did.
--
-- 2. "Opname belum ditandai" gated on any design reaching 'Submit Peta' —
--    the old model's true end-of-chain signal. Per the actual workflow
--    (opname happens once Desain Siteplan is done, not after the whole
--    Finalisasi Desain phase too), the gate now checks the siteplan-phase
--    record specifically for 'Finish', which is reachable weeks before
--    Finalisasi Desain's own 'Submit Peta' ever is.
-- ============================================================================

create or replace view v_bottleneck
with (security_invoker = true) as
SELECT 'operational'::text AS area,
    'SPK belum memiliki jadwal'::text AS reason,
    s.id AS spk_id,
    s.spk_number,
    'warning'::notification_severity AS severity,
    NULL::numeric AS metric,
    s.site_code
   FROM spks s
  WHERE s.status = 'On Going'::spk_status AND NOT (EXISTS ( SELECT 1
           FROM daily_plans p
          WHERE p.spk_id = s.id AND p.status = 'Active'::record_status))
UNION ALL
 SELECT 'operational'::text AS area,
    'SPK belum memiliki Vendor Jasa Survey'::text AS reason,
    s.id AS spk_id,
    s.spk_number,
    'warning'::notification_severity AS severity,
    NULL::numeric AS metric,
    s.site_code
   FROM spks s
  WHERE s.status = 'On Going'::spk_status AND s.vendor_id IS NULL AND NOT (EXISTS ( SELECT 1
           FROM spk_assignments a
          WHERE a.spk_id = s.id AND a.status = 'Active'::record_status))
UNION ALL
 SELECT 'operational'::text AS area,
    'Vendor Jasa Survey terlambat update'::text AS reason,
    s.id AS spk_id,
    s.spk_number,
    'warning'::notification_severity AS severity,
    CURRENT_DATE - max(dp.progress_date) AS metric,
    s.site_code
   FROM spks s
     JOIN daily_progress dp ON dp.spk_id = s.id AND dp.status = 'Active'::record_status
  WHERE s.status = 'On Going'::spk_status
  GROUP BY s.id, s.spk_number, s.site_code
 HAVING (CURRENT_DATE - max(dp.progress_date))::numeric > setting_number('vendor_update_late_days'::text, 2::numeric)
UNION ALL
 SELECT 'design'::text AS area,
    'Design tidak berubah status lebih dari seminggu'::text AS reason,
    d.spk_id,
    s.spk_number,
    'warning'::notification_severity AS severity,
    round(EXTRACT(epoch FROM now() - d.updated_at) / 86400.0, 2) AS metric,
    s.site_code
   FROM designs d
     JOIN spks s ON s.id = d.spk_id
  WHERE d.status = 'Active'::record_status
    AND d.current_stage NOT IN ('Finish'::design_stage, 'Submit Peta'::design_stage)
    AND (EXTRACT(epoch FROM now() - d.updated_at) / 86400.0) > setting_number('design_stage_max_days'::text, 7::numeric)
UNION ALL
 SELECT 'routing'::text AS area,
    'Routing stage melewati lead time'::text AS reason,
    lt.spk_id,
    s.spk_number,
    'critical'::notification_severity AS severity,
    lt.elapsed_days AS metric,
    s.site_code
   FROM v_routing_lead_time lt
     JOIN spks s ON s.id = lt.spk_id
  WHERE lt.is_overdue AND (lt.status = ANY (ARRAY['Pending'::routing_status, 'In Progress'::routing_status]))
UNION ALL
 SELECT 'financial'::text AS area,
    'Opname belum ditandai'::text AS reason,
    s.id AS spk_id,
    s.spk_number,
    'warning'::notification_severity AS severity,
    NULL::numeric AS metric,
    s.site_code
   FROM spks s
  WHERE (s.status = ANY (ARRAY['On Going'::spk_status, 'Selesai'::spk_status]))
    AND s.opname_marked_at IS NULL
    AND (NOT (EXISTS ( SELECT 1
           FROM designs d
          WHERE d.spk_id = s.id AND d.phase = 'siteplan'::design_phase AND d.status = 'Active'::record_status))
         OR (EXISTS ( SELECT 1
           FROM designs d
          WHERE d.spk_id = s.id AND d.phase = 'siteplan'::design_phase AND d.status = 'Active'::record_status
            AND d.current_stage = 'Finish'::design_stage)))
UNION ALL
 SELECT 'financial'::text AS area,
    'PAD belum ditandai'::text AS reason,
    s.id AS spk_id,
    s.spk_number,
    'warning'::notification_severity AS severity,
    NULL::numeric AS metric,
    s.site_code
   FROM spks s
  WHERE (s.status = ANY (ARRAY['On Going'::spk_status, 'Selesai'::spk_status]))
    AND s.opname_marked_at IS NOT NULL
    AND s.pad_marked_at IS NULL
UNION ALL
 SELECT 'financial'::text AS area,
    'Invoice belum dibuat'::text AS reason,
    s.id AS spk_id,
    s.spk_number,
    'warning'::notification_severity AS severity,
    NULL::numeric AS metric,
    s.site_code
   FROM spks s
  WHERE (s.status = ANY (ARRAY['On Going'::spk_status, 'Selesai'::spk_status]))
    AND s.pad_marked_at IS NOT NULL
    AND NOT (EXISTS ( SELECT 1
           FROM invoices i
          WHERE i.spk_id = s.id AND i.status <> 'Cancelled'::financial_doc_status))
UNION ALL
 SELECT 'financial'::text AS area,
    'Payment belum diterima'::text AS reason,
    f.spk_id,
    f.spk_number,
    'warning'::notification_severity AS severity,
    f.outstanding_payment AS metric,
    s.site_code
   FROM v_spk_financial f
     JOIN spks s ON s.id = f.spk_id
  WHERE f.invoice_total > 0::numeric AND f.outstanding_payment > 0::numeric;

comment on view v_bottleneck is
  'Section 9 — every bottleneck condition in one place, thresholds from app_settings.';
