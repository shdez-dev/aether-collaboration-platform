ALTER TABLE board_sprints ADD COLUMN project_id UUID;

ALTER TABLE board_sprints
  ADD CONSTRAINT board_sprints_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

UPDATE board_sprints s
SET project_id = linked.project_id
FROM (
  SELECT DISTINCT ON (board_id) board_id, project_id
  FROM project_boards
  ORDER BY board_id, added_at
) linked
WHERE s.board_id = linked.board_id;

ALTER TABLE board_sprints ALTER COLUMN board_id DROP NOT NULL;
ALTER TABLE board_sprints DROP CONSTRAINT IF EXISTS board_sprints_board_id_fkey;
ALTER TABLE board_sprints
  ADD CONSTRAINT board_sprints_board_id_fkey
  FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE SET NULL;

ALTER TABLE board_sprints
  ADD CONSTRAINT board_sprints_scope_check
  CHECK (project_id IS NOT NULL OR board_id IS NOT NULL);

CREATE INDEX board_sprints_project_id_status_idx ON board_sprints(project_id, status);
