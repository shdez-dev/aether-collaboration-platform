-- Give existing projects a usable three-character code prefix and backfill
-- cards that were already on project boards when card codes were introduced.
DO $$
DECLARE
  project_row RECORD;
  word_parts TEXT[];
  candidate TEXT;
  generated_code TEXT;
  normalized_name TEXT;
  alphabet CONSTANT TEXT := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  i INTEGER;
  code_index INTEGER;
  prefix_found BOOLEAN;
BEGIN
  FOR project_row IN
    SELECT id, workspace_id, name
      FROM projects
     WHERE card_prefix IS NULL
     ORDER BY workspace_id, created_at, id
  LOOP
    normalized_name := regexp_replace(
      translate(upper(COALESCE(project_row.name, '')), 'ÁÉÍÓÚÜÑ', 'AEIOUUN'),
      '[^A-Z0-9]+', ' ', 'g'
    );
    word_parts := array_remove(regexp_split_to_array(btrim(normalized_name), '\s+'), '');
    candidate := '';

    IF COALESCE(array_length(word_parts, 1), 0) = 1 THEN
      candidate := left(word_parts[1], 3);
    ELSIF COALESCE(array_length(word_parts, 1), 0) > 1 THEN
      FOR i IN 1..LEAST(3, array_length(word_parts, 1)) LOOP
        candidate := candidate || left(word_parts[i], 1);
      END LOOP;

      IF length(candidate) < 3 THEN
        FOR i IN 1..array_length(word_parts, 1) LOOP
          candidate := candidate || substr(word_parts[i], 2);
          EXIT WHEN length(candidate) >= 3;
        END LOOP;
        candidate := left(candidate, 3);
      END IF;
    END IF;

    IF length(candidate) <> 3 THEN
      candidate := 'PRO';
    END IF;

    prefix_found := NOT EXISTS (
      SELECT 1 FROM projects
       WHERE workspace_id = project_row.workspace_id
         AND card_prefix = candidate
    );

    IF NOT prefix_found THEN
      FOR i IN 1..length(alphabet) LOOP
        generated_code := left(candidate, 2) || substr(alphabet, i, 1);
        IF NOT EXISTS (
          SELECT 1 FROM projects
           WHERE workspace_id = project_row.workspace_id
             AND card_prefix = generated_code
        ) THEN
          candidate := generated_code;
          prefix_found := TRUE;
          EXIT;
        END IF;
      END LOOP;
    END IF;

    IF NOT prefix_found THEN
      FOR code_index IN 0..46655 LOOP
        generated_code :=
          substr(alphabet, (code_index / 1296) + 1, 1) ||
          substr(alphabet, ((code_index / 36) % 36) + 1, 1) ||
          substr(alphabet, (code_index % 36) + 1, 1);
        IF NOT EXISTS (
          SELECT 1 FROM projects
           WHERE workspace_id = project_row.workspace_id
             AND card_prefix = generated_code
        ) THEN
          candidate := generated_code;
          prefix_found := TRUE;
          EXIT;
        END IF;
      END LOOP;
    END IF;

    IF NOT prefix_found THEN
      RAISE EXCEPTION 'No hay prefijos de tres caracteres disponibles para el espacio %', project_row.workspace_id;
    END IF;

    UPDATE projects SET card_prefix = candidate WHERE id = project_row.id;
  END LOOP;
END $$;

-- Keep sequence numbers at two digits minimum, without truncating after 99.
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
      NEW.card_code := project_prefix || '-' || LPAD(assigned_number::TEXT, GREATEST(2, length(assigned_number::TEXT)), '0');
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
           card_code = project_prefix || '-' || LPAD(assigned_number::TEXT, GREATEST(2, length(assigned_number::TEXT)), '0')
     WHERE id = existing_card.id
       AND card_code IS NULL;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Existing project-board links do not fire the link trigger, so assign codes
-- to those cards explicitly and advance each project's counter atomically.
DO $$
DECLARE
  project_row RECORD;
  existing_card RECORD;
  project_prefix TEXT;
  assigned_number INTEGER;
BEGIN
  FOR project_row IN
    SELECT id FROM projects WHERE card_prefix IS NOT NULL ORDER BY workspace_id, created_at, id
  LOOP
    FOR existing_card IN
      SELECT DISTINCT c.id, c.created_at
        FROM cards c
        JOIN lists l ON l.id = c.list_id
        JOIN project_boards pb ON pb.board_id = l.board_id
       WHERE pb.project_id = project_row.id
         AND c.card_code IS NULL
       ORDER BY c.created_at, c.id
    LOOP
      UPDATE projects
         SET next_card_number = next_card_number + 1
       WHERE id = project_row.id
       RETURNING card_prefix, next_card_number - 1
            INTO project_prefix, assigned_number;

      UPDATE cards
         SET project_id = project_row.id,
             card_code = project_prefix || '-' || LPAD(assigned_number::TEXT, GREATEST(2, length(assigned_number::TEXT)), '0')
       WHERE id = existing_card.id
         AND card_code IS NULL;
    END LOOP;
  END LOOP;
END $$;
