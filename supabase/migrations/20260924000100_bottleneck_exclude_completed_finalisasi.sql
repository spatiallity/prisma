-- Acc PIC Pertamina is the terminal stage for Finalisasi Desain. The phase
-- has already been approved at this point, so its historic updated_at must
-- never make it appear as a stalled design bottleneck.
create or replace view v_bottleneck as
 SELECT 'design'::text AS area,
    'Design tidak berubah status'::text AS reason,
    d.spk_id,
    s.spk_number,
        CASE
            WHEN (EXTRACT(epoch FROM now() - d.updated_at) / 86400.0) > setting_number('design_stage_critical_days'::text, 14::numeric) THEN 'critical'::text
            ELSE 'warning'::text
        END::notification_severity AS severity,
    round(EXTRACT(epoch FROM now() - d.updated_at) / 86400.0, 2) AS metric,
    s.site_code
   FROM designs d
     JOIN spks s ON s.id = d.spk_id
  WHERE d.status = 'Active'::record_status
    AND d.current_stage <> ALL (ARRAY['Finish'::design_stage, 'Review PIC Pertamina'::design_stage, 'Acc PIC Pertamina'::design_stage])
    AND (EXTRACT(epoch FROM now() - d.updated_at) / 86400.0) > setting_number('design_stage_max_days'::text, 7::numeric)
UNION ALL
 SELECT 'routing'::text AS area,
    'Routing tidak berubah status'::text AS reason,
    lt.spk_id,
    s.spk_number,
        CASE
            WHEN lt.elapsed_days > setting_number('routing_stage_critical_days'::text, 14::numeric) THEN 'critical'::text
            ELSE 'warning'::text
        END::notification_severity AS severity,
    lt.elapsed_days AS metric,
    s.site_code
   FROM ( SELECT DISTINCT ON (v_routing_lead_time.spk_routing_id) v_routing_lead_time.routing_history_id,
            v_routing_lead_time.spk_id,
            v_routing_lead_time.spk_routing_id,
            v_routing_lead_time.document_type,
            v_routing_lead_time.step_name,
            v_routing_lead_time.sequence,
            v_routing_lead_time.status,
            v_routing_lead_time.started_at,
            v_routing_lead_time.completed_at,
            v_routing_lead_time.duration_days,
            v_routing_lead_time.sla_days,
            v_routing_lead_time.elapsed_days,
            v_routing_lead_time.is_overdue
           FROM v_routing_lead_time
          WHERE v_routing_lead_time.status = ANY (ARRAY['Pending'::routing_status, 'In Progress'::routing_status, 'Returned'::routing_status])
          ORDER BY v_routing_lead_time.spk_routing_id, v_routing_lead_time.sequence) lt
     JOIN spks s ON s.id = lt.spk_id
  WHERE lt.elapsed_days > setting_number('routing_stage_max_days'::text, 7::numeric)
UNION ALL
 SELECT 'financial'::text AS area,
    'Belum opname'::text AS reason,
    s.id AS spk_id,
    s.spk_number,
    'warning'::notification_severity AS severity,
    NULL::numeric AS metric,
    s.site_code
   FROM spks s
  WHERE (s.status = ANY (ARRAY['On Going'::spk_status, 'Selesai'::spk_status]))
    AND s.opname_marked_at IS NULL
    AND EXISTS ( SELECT 1
           FROM designs d
          WHERE d.spk_id = s.id AND d.phase = 'siteplan'::design_phase AND d.status = 'Active'::record_status AND d.current_stage = 'Finish'::design_stage)
UNION ALL
 SELECT 'financial'::text AS area,
    'Belum PAD'::text AS reason,
    s.id AS spk_id,
    s.spk_number,
    'warning'::notification_severity AS severity,
    NULL::numeric AS metric,
    s.site_code
   FROM spks s
  WHERE (s.status = ANY (ARRAY['On Going'::spk_status, 'Selesai'::spk_status])) AND s.opname_marked_at IS NOT NULL AND s.pad_marked_at IS NULL;

comment on view v_bottleneck is
  'Section 9 — every bottleneck condition in one place, thresholds from app_settings.';
