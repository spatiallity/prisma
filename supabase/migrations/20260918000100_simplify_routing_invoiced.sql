-- Invoiced is the terminal invoice event, not a second Finance stage.
-- Keep old Finance history intact for audit; application queries ignore it.

insert into routing_template_steps (template_id, name, sequence, sla_days, default_pic_role)
select t.id, 'Invoiced', coalesce(max(s.sequence), 0) + 1, null, 'Finance'
from routing_templates t
left join routing_template_steps s on s.template_id = t.id
where not exists (
  select 1 from routing_template_steps existing
  where existing.template_id = t.id and existing.name = 'Invoiced'
)
group by t.id;

-- Finance completed used to mean the invoice event was already finished.
-- Preserve missing invoice details as incomplete legacy records rather than
-- inventing a date or value.
update routing_history invoiced
set status = 'Completed'
from routing_history finance
where finance.spk_routing_id = invoiced.spk_routing_id
  and finance.step_name = 'Finance'
  and finance.status = 'Completed'
  and invoiced.step_name = 'Invoiced'
  and invoiced.status <> 'Completed';
