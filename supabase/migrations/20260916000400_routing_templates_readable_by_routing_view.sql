-- Routing Monitor (module 'routing') reads routing_templates/
-- routing_template_steps just to know the step structure to render — that's
-- a read prerequisite for viewing the monitor at all, not the same thing as
-- being allowed to edit the template definitions from Admin > Routing
-- Template (module 'master_data', unchanged). Any role with routing:view
-- but not master_data:view (e.g. a view-only Tester role) previously saw a
-- broken matrix with no step columns because these two SELECT policies only
-- ever checked master_data:view.
alter policy routing_templates_select on routing_templates
  using (
    (has_perm('master_data'::app_module, 'view'::app_action) or has_perm('routing'::app_module, 'view'::app_action))
    and current_vendor_id() is null
  );

alter policy routing_template_steps_select on routing_template_steps
  using (
    (has_perm('master_data'::app_module, 'view'::app_action) or has_perm('routing'::app_module, 'view'::app_action))
    and current_vendor_id() is null
  );
