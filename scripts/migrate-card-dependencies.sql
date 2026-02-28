-- ============================================================================
-- MIGRACIÓN: Dependencias entre Cards
-- Fecha: 2026-02-17
-- Descripción: Agrega la tabla card_dependencies para modelar relaciones
--              de bloqueo entre cards ("A debe completarse antes que B").
--
-- INSTRUCCIONES: Ejecuta este script en tu base de datos local.
--   psql -U <usuario> -d <base_de_datos> -f migrate-card-dependencies.sql
-- ============================================================================

-- Tabla de dependencias entre cards
-- blocking_card_id : la card que DEBE completarse primero (bloquea a la otra)
-- blocked_card_id  : la card que no puede iniciarse hasta que blocking esté lista
CREATE TABLE IF NOT EXISTS card_dependencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blocking_card_id UUID NOT NULL,
  blocked_card_id  UUID NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dep_blocking FOREIGN KEY (blocking_card_id) REFERENCES cards(id) ON DELETE CASCADE,
  CONSTRAINT fk_dep_blocked  FOREIGN KEY (blocked_card_id)  REFERENCES cards(id) ON DELETE CASCADE,
  CONSTRAINT fk_dep_creator  FOREIGN KEY (created_by)       REFERENCES users(id),
  CONSTRAINT no_self_dep     CHECK (blocking_card_id <> blocked_card_id),
  CONSTRAINT unique_dep      UNIQUE (blocking_card_id, blocked_card_id)
);

-- Índices para consultas eficientes en ambas direcciones
CREATE INDEX IF NOT EXISTS idx_dep_blocking ON card_dependencies(blocking_card_id);
CREATE INDEX IF NOT EXISTS idx_dep_blocked  ON card_dependencies(blocked_card_id);

SELECT 'Migration completed: card_dependencies table created successfully.' AS result;
