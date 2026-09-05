-- Migration 0020 split each design's Finish transition off by moving the
-- Finalisasi Desain stages onto a new record, but under the old model
-- advancing past Finish completed the Finish revision itself (since it was
-- the same record continuing). Under the new model Finish is the terminal
-- stage of its own record -- nothing advances past it there anymore, so it
-- stays open, the same way a freshly-reached Finish revision already does
-- going forward (see advanceStage). Reopen the latest Finish revision on
-- every siteplan record the split left completed, so it reads as "current
-- stage: Finish" instead of misreading as an unstarted Draft.
update design_revisions dr
set completed_at = null
from designs d
where dr.design_id = d.id
  and d.phase = 'siteplan'
  and d.current_stage = 'Finish'
  and dr.stage = 'Finish'
  and dr.completed_at is not null
  and dr.id = (
    select dr2.id from design_revisions dr2
    where dr2.design_id = d.id and dr2.status = 'Active'
    order by dr2.revision_no desc, dr2.created_at desc
    limit 1
  );
