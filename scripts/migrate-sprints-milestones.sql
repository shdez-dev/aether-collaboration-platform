-- migrate-sprints-milestones.sql
-- Ejecutar en la base de datos existente para añadir soporte de sprints e hitos

CREATE TABLE IF NOT EXISTS board_sprints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  goal TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'ACTIVE', 'COMPLETED')),
  position INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_board_sprints_board FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
  CONSTRAINT fk_board_sprints_created_by FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_board_sprints_board ON board_sprints(board_id);
CREATE INDEX IF NOT EXISTS idx_board_sprints_status ON board_sprints(status);
CREATE INDEX IF NOT EXISTS idx_board_sprints_dates ON board_sprints(start_date, end_date);

CREATE TABLE IF NOT EXISTS board_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id UUID NOT NULL,
  sprint_id UUID,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#f59e0b',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_board_milestones_board FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
  CONSTRAINT fk_board_milestones_sprint FOREIGN KEY (sprint_id) REFERENCES board_sprints(id) ON DELETE SET NULL,
  CONSTRAINT fk_board_milestones_created_by FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_board_milestones_board ON board_milestones(board_id);
CREATE INDEX IF NOT EXISTS idx_board_milestones_sprint ON board_milestones(sprint_id);
CREATE INDEX IF NOT EXISTS idx_board_milestones_date ON board_milestones(date);

CREATE TABLE IF NOT EXISTS sprint_cards (
  sprint_id UUID NOT NULL,
  card_id UUID NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  added_by UUID NOT NULL,
  CONSTRAINT pk_sprint_cards PRIMARY KEY (sprint_id, card_id),
  CONSTRAINT fk_sprint_cards_sprint FOREIGN KEY (sprint_id) REFERENCES board_sprints(id) ON DELETE CASCADE,
  CONSTRAINT fk_sprint_cards_card FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
  CONSTRAINT fk_sprint_cards_added_by FOREIGN KEY (added_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sprint_cards_sprint ON sprint_cards(sprint_id);
CREATE INDEX IF NOT EXISTS idx_sprint_cards_card ON sprint_cards(card_id);

CREATE OR REPLACE FUNCTION update_board_sprints_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_board_sprints_timestamp
  BEFORE UPDATE ON board_sprints
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION update_board_sprints_updated_at();

SELECT 'Sprint migration completed successfully!' as message;
