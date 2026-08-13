-- A board is an execution surface for one project. Legacy shared boards are
-- left untouched for a safe rollout; the API hides them unless the viewer can
-- access every linked project. This trigger prevents new cross-project links,
-- including concurrent requests that pass an application-level pre-check.
CREATE OR REPLACE FUNCTION prevent_project_board_reuse()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM project_boards pb
    WHERE pb.board_id = NEW.board_id
      AND pb.project_id <> NEW.project_id
  ) THEN
    RAISE EXCEPTION 'A board can belong to only one project'
      USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS project_boards_prevent_reuse ON project_boards;
CREATE TRIGGER project_boards_prevent_reuse
  BEFORE INSERT OR UPDATE OF board_id, project_id ON project_boards
  FOR EACH ROW
  EXECUTE FUNCTION prevent_project_board_reuse();
