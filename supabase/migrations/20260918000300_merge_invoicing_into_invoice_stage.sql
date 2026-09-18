-- Keep Invoice as one routing stage. The two labels are only summary-card
-- states: Invoicing while it is open, Invoiced once it is completed.
-- Consolidate the temporary Invoicing rows into the terminal invoice stage.
update routing_history invoice
set
  started_at = case
    -- Imported work dates can be newer than an already-recorded invoice.
    -- Preserve the invoice completion and leave that false start blank.
    when invoice.completed_at is not null
      and work.started_at is not null
      and work.started_at > invoice.completed_at
      then coalesce(invoice.started_at, invoice.completed_at)
    else coalesce(work.started_at, invoice.started_at)
  end,
  completed_at = case
    when invoice.status = 'Completed' then invoice.completed_at
    when work.status = 'Completed' then work.completed_at
    else null
  end,
  status = case
    when invoice.status = 'Completed' or work.status = 'Completed' then 'Completed'::routing_status
    when work.status = 'Returned' then 'Returned'::routing_status
    when work.status = 'Rejected' then 'Rejected'::routing_status
    else 'In Progress'::routing_status
  end,
  pic_name = coalesce(invoice.pic_name, work.pic_name),
  note = coalesce(invoice.note, work.note)
from routing_history work
where work.spk_routing_id = invoice.spk_routing_id
  and work.step_name = 'Invoicing'
  and invoice.step_name = 'Invoiced';

delete from routing_history
where step_name = 'Invoicing';

with deleted as (
  delete from routing_template_steps
  where name = 'Invoicing'
  returning template_id, sequence
)
update routing_template_steps step
set sequence = step.sequence - 1
from deleted
where step.template_id = deleted.template_id
  and step.sequence > deleted.sequence;

-- History sequence follows the retained Invoiced template step. This keeps
-- the matrix and the current-stage lookup aligned after the merge.
update routing_history history
set sequence = template_step.sequence,
    template_step_id = template_step.id
from spk_routing routing
join routing_template_steps template_step
  on template_step.template_id = routing.template_id
 and template_step.name = 'Invoiced'
where history.spk_routing_id = routing.id
  and history.step_name = 'Invoiced';
