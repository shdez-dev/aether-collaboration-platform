-- =============================================================================
-- MIGRACIÓN: Comentarios en documentos (inline comments)
-- Fecha: 2026-02-18
-- Descripción:
--   1. Corrige la FK parent_id en document_comments para que sea ON DELETE CASCADE
--      (antes no tenía acción, lo que causaba error al borrar un comentario raíz
--      que tuviera respuestas).
--   2. Corrige la FK created_by para que sea ON DELETE CASCADE (consistente con
--      el resto del esquema).
--   3. Añade índices parciales para mejorar la performance de las queries más
--      frecuentes: listar comentarios abiertos y listar threads raíz.
--   4. Extrae la función del trigger de document_comments a su propia función
--      (update_document_comment_updated_at) en lugar de compartir la de documents.
--
-- CÓMO EJECUTAR:
--   psql -U <usuario> -d <base_de_datos> -f migrate-document-comments.sql
--
-- SEGURO para ejecutar en base de datos existente: usa IF NOT EXISTS / OR REPLACE
-- y DROP CONSTRAINT solo si existe. No modifica datos.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Recrear FK de parent_id con ON DELETE CASCADE
-- ---------------------------------------------------------------------------

-- Eliminar constraint existente (si existe)
ALTER TABLE document_comments
  DROP CONSTRAINT IF EXISTS fk_document_comments_parent;

-- Recrear con ON DELETE CASCADE
-- Al borrar un comentario raíz, sus respuestas se eliminan automáticamente
ALTER TABLE document_comments
  ADD CONSTRAINT fk_document_comments_parent
    FOREIGN KEY (parent_id)
    REFERENCES document_comments(id)
    ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- 2. Recrear FK de created_by con ON DELETE CASCADE
-- ---------------------------------------------------------------------------

ALTER TABLE document_comments
  DROP CONSTRAINT IF EXISTS fk_document_comments_creator;

ALTER TABLE document_comments
  ADD CONSTRAINT fk_document_comments_creator
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- 3. Añadir índices parciales nuevos
-- ---------------------------------------------------------------------------

-- Comentarios abiertos por documento (caso de uso más frecuente en la API)
CREATE INDEX IF NOT EXISTS idx_document_comments_document_open
  ON document_comments(document_id, created_at ASC)
  WHERE resolved = FALSE;

-- Threads raíz por documento (para construir el árbol sin traer replies)
CREATE INDEX IF NOT EXISTS idx_document_comments_roots
  ON document_comments(document_id, created_at ASC)
  WHERE parent_id IS NULL;

-- ---------------------------------------------------------------------------
-- 4. Función dedicada para el trigger de updated_at en document_comments
--    (antes reutilizaba update_document_updated_at, ahora tiene la suya)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_document_comment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Reemplazar el trigger para que apunte a la función correcta
DROP TRIGGER IF EXISTS trigger_update_document_comment_timestamp ON document_comments;

CREATE TRIGGER trigger_update_document_comment_timestamp
  BEFORE UPDATE ON document_comments
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION update_document_comment_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Verificación final
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_fk_parent    TEXT;
  v_fk_creator   TEXT;
  v_idx_open     BOOLEAN;
  v_idx_roots    BOOLEAN;
  v_trigger      BOOLEAN;
BEGIN
  -- Verificar FK parent_id
  SELECT confdeltype INTO v_fk_parent
    FROM pg_constraint
   WHERE conname = 'fk_document_comments_parent'
     AND conrelid = 'document_comments'::regclass;

  -- Verificar FK created_by
  SELECT confdeltype INTO v_fk_creator
    FROM pg_constraint
   WHERE conname = 'fk_document_comments_creator'
     AND conrelid = 'document_comments'::regclass;

  -- Verificar índices parciales
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE tablename = 'document_comments'
       AND indexname  = 'idx_document_comments_document_open'
  ) INTO v_idx_open;

  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE tablename = 'document_comments'
       AND indexname  = 'idx_document_comments_roots'
  ) INTO v_idx_roots;

  -- Verificar trigger
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgname   = 'trigger_update_document_comment_timestamp'
       AND tgrelid  = 'document_comments'::regclass
  ) INTO v_trigger;

  RAISE NOTICE '----------------------------------------------';
  RAISE NOTICE 'Verificación de migración document_comments:';
  RAISE NOTICE '  FK parent_id  ON DELETE CASCADE : %', (v_fk_parent  = 'c');
  RAISE NOTICE '  FK created_by ON DELETE CASCADE : %', (v_fk_creator = 'c');
  RAISE NOTICE '  Índice document_open            : %', v_idx_open;
  RAISE NOTICE '  Índice roots                    : %', v_idx_roots;
  RAISE NOTICE '  Trigger updated_at              : %', v_trigger;
  RAISE NOTICE '----------------------------------------------';

  IF v_fk_parent  != 'c' OR
     v_fk_creator != 'c' OR
     NOT v_idx_open       OR
     NOT v_idx_roots      OR
     NOT v_trigger
  THEN
    RAISE EXCEPTION 'Una o más verificaciones fallaron. Revisa los NOTICE anteriores.';
  END IF;

  RAISE NOTICE 'Migración completada exitosamente.';
END;
$$;

COMMIT;
