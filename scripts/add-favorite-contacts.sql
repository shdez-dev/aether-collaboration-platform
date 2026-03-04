-- ============================================================================
-- MIGRATION: Add User Favorite Contacts Feature
-- Description: Permite a los usuarios marcar contactos como favoritos
-- Date: 2026-03-02
-- ============================================================================

-- Crear tabla de contactos favoritos
CREATE TABLE IF NOT EXISTS user_favorite_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  favorite_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, favorite_user_id),
  CHECK (user_id != favorite_user_id)
);

-- Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_user_favorite_contacts_user_id 
  ON user_favorite_contacts(user_id);

CREATE INDEX IF NOT EXISTS idx_user_favorite_contacts_favorite_user_id 
  ON user_favorite_contacts(favorite_user_id);

-- Verificar que la tabla se creó correctamente
SELECT 
  'user_favorite_contacts' as table_name,
  COUNT(*) as record_count 
FROM user_favorite_contacts;

-- Success message
SELECT '✅ Favorite contacts feature added successfully!' as message;
