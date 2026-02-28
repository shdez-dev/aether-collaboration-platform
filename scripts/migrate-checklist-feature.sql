-- ============================================================================
-- MIGRACIÓN: Subtareas / Checklist en Cards
-- Fecha: 2026-02-17
-- Descripción: Agrega la tabla card_checklist_items para soportar subtareas
--              dentro de cada card del tablero kanban.
--
-- INSTRUCCIONES: Ejecuta este script en tu base de datos local.
--   psql -U <usuario> -d <base_de_datos> -f migrate-checklist-feature.sql
-- ============================================================================

-- Tabla de ítems del checklist
CREATE TABLE IF NOT EXISTS card_checklist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id UUID NOT NULL,
  title VARCHAR(500) NOT NULL,
  completed BOOLEAN DEFAULT FALSE NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_checklist_card FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
  CONSTRAINT fk_checklist_creator FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_checklist_card ON card_checklist_items(card_id);
CREATE INDEX IF NOT EXISTS idx_checklist_card_position ON card_checklist_items(card_id, position);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_checklist_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_checklist_updated_at ON card_checklist_items;
CREATE TRIGGER trigger_checklist_updated_at
  BEFORE UPDATE ON card_checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION update_checklist_updated_at();

SELECT 'Migration completed: card_checklist_items table created successfully.' AS result;
