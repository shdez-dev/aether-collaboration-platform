CREATE OR REPLACE FUNCTION enforce_project_milestone_deadline()
RETURNS TRIGGER AS $$
DECLARE
  project_deadline TIMESTAMP(3);
BEGIN
  SELECT end_date
    INTO project_deadline
    FROM projects
   WHERE id = NEW.project_id
   FOR UPDATE;

  IF project_deadline IS NOT NULL
     AND NEW.date IS NOT NULL
     AND NEW.date::date > project_deadline::date THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT = 'project_milestone_deadline_guard',
      MESSAGE = 'La fecha del hito debe ser igual o anterior a la fecha límite del proyecto.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER project_milestone_deadline_guard
BEFORE INSERT OR UPDATE OF project_id, date ON project_milestones
FOR EACH ROW
EXECUTE FUNCTION enforce_project_milestone_deadline();

CREATE OR REPLACE FUNCTION enforce_project_deadline_after_milestones()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.end_date IS NOT DISTINCT FROM OLD.end_date THEN
    RETURN NEW;
  END IF;

  IF NEW.end_date IS NOT NULL AND EXISTS (
    SELECT 1
      FROM project_milestones
     WHERE project_id = NEW.id
       AND date::date > NEW.end_date::date
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT = 'project_deadline_milestones_guard',
      MESSAGE = 'La fecha límite del proyecto no puede quedar antes de la fecha de uno o más hitos.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER project_deadline_milestones_guard
BEFORE UPDATE OF end_date ON projects
FOR EACH ROW
EXECUTE FUNCTION enforce_project_deadline_after_milestones();
