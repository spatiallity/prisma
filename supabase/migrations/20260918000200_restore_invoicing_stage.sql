-- Invoicing is the working stage after document approval. Invoiced remains
-- the final event where invoice number, value, and invoice date are recorded.
-- The previous migration hid the old Finance rows; retain their history by
-- renaming them instead of dropping them.
update routing_template_steps
set name = 'Invoicing'
where name = 'Finance';

update routing_template_steps
set default_pic_role = 'Invoicing'
where name = 'Invoicing'
  and default_pic_role = 'Finance';

update routing_history
set step_name = 'Invoicing'
where step_name = 'Finance';

-- A template created after the earlier simplification may not contain its
-- working invoicing stage. Add it immediately before Invoiced when absent.
with missing as (
  select
    t.id as template_id,
    coalesce((
      select min(s.sequence)
      from routing_template_steps s
      where s.template_id = t.id and s.name = 'Invoiced'
    ), coalesce((select max(s.sequence) + 1 from routing_template_steps s where s.template_id = t.id), 1)) as sequence
  from routing_templates t
  where not exists (
    select 1 from routing_template_steps s
    where s.template_id = t.id and s.name = 'Invoicing'
  )
),
shifted as (
  update routing_template_steps step
  set sequence = step.sequence + 1000
  from missing
  where step.template_id = missing.template_id
    and step.sequence >= missing.sequence
  returning step.id
),
settled as (
  update routing_template_steps step
  set sequence = step.sequence - 999
  from missing
  where step.template_id = missing.template_id
    and step.sequence >= missing.sequence + 1000
  returning step.id
)
insert into routing_template_steps (template_id, name, sequence, sla_days, default_pic_role)
select template_id, 'Invoicing', sequence, null, 'Invoicing'
from missing;

-- The only imported 14 Sep drafting dates were placeholders. Do not make a
-- new schedule out of them; leave the ongoing stage untimed until users enter
-- its actual start and finish dates.
update routing_history
set started_at = null,
    completed_at = null
where step_name = 'Drafting Dokumen Invoice'
  and (
    started_at::date = date '2026-09-14'
    or completed_at::date = date '2026-09-14'
  );
