ALTER TABLE "projects"
  ADD COLUMN "card_prefix" VARCHAR(6),
  ADD COLUMN "next_card_number" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_card_prefix_format_check"
    CHECK ("card_prefix" IS NULL OR "card_prefix" ~ '^[A-Z0-9]{2,6}$'),
  ADD CONSTRAINT "projects_next_card_number_check"
    CHECK ("next_card_number" > 0);

ALTER TABLE "cards"
  ADD COLUMN "project_id" UUID,
  ADD COLUMN "card_code" VARCHAR(24);

CREATE INDEX "cards_project_id_idx" ON "cards"("project_id");
CREATE UNIQUE INDEX "cards_project_id_card_code_key" ON "cards"("project_id", "card_code");
CREATE UNIQUE INDEX "projects_workspace_card_prefix_key" ON "projects"("workspace_id", "card_prefix");

ALTER TABLE "cards"
  ADD CONSTRAINT "cards_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION assign_project_card_code_before_insert()
RETURNS TRIGGER AS $$
DECLARE
  linked_project_id UUID;
  project_prefix TEXT;
  assigned_number INTEGER;
BEGIN
  SELECT pb.project_id, p.card_prefix
    INTO linked_project_id, project_prefix
    FROM lists l
    JOIN project_boards pb ON pb.board_id = l.board_id
    JOIN projects p ON p.id = pb.project_id
   WHERE l.id = NEW.list_id
   LIMIT 1;

  IF linked_project_id IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.project_id := linked_project_id;

  IF NEW.card_code IS NULL AND project_prefix IS NOT NULL THEN
    UPDATE projects
       SET next_card_number = next_card_number + 1
     WHERE id = linked_project_id
     RETURNING card_prefix, next_card_number - 1
          INTO project_prefix, assigned_number;

    IF project_prefix IS NOT NULL THEN
      NEW.card_code := project_prefix || '-' || LPAD(assigned_number::TEXT, 2, '0');
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cards_assign_project_card_code
BEFORE INSERT ON "cards"
FOR EACH ROW
EXECUTE FUNCTION assign_project_card_code_before_insert();

CREATE OR REPLACE FUNCTION backfill_project_card_codes_after_board_link()
RETURNS TRIGGER AS $$
DECLARE
  existing_card RECORD;
  project_prefix TEXT;
  assigned_number INTEGER;
BEGIN
  SELECT card_prefix INTO project_prefix FROM projects WHERE id = NEW.project_id;
  IF project_prefix IS NULL THEN
    RETURN NEW;
  END IF;

  FOR existing_card IN
    SELECT c.id
      FROM cards c
      JOIN lists l ON l.id = c.list_id
     WHERE l.board_id = NEW.board_id
       AND c.card_code IS NULL
     ORDER BY c.created_at, c.id
  LOOP
    UPDATE projects
       SET next_card_number = next_card_number + 1
     WHERE id = NEW.project_id
     RETURNING card_prefix, next_card_number - 1
          INTO project_prefix, assigned_number;

    UPDATE cards
       SET project_id = NEW.project_id,
           card_code = project_prefix || '-' || LPAD(assigned_number::TEXT, 2, '0')
     WHERE id = existing_card.id
       AND card_code IS NULL;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER project_boards_backfill_card_codes
AFTER INSERT ON "project_boards"
FOR EACH ROW
EXECUTE FUNCTION backfill_project_card_codes_after_board_link();
