-- Keep the stable role keys so existing project/team assignments retain their permissions.
-- Only rename untouched system defaults; preserve names customized by organization admins.
UPDATE organization_access_roles
   SET name = 'Administrador',
       description = 'Administra permisos y configuración dentro de proyectos y equipos.',
       updated_at = CURRENT_TIMESTAMP
 WHERE role_key = 'ADMIN'
   AND is_system = TRUE
   AND name = 'Coordinador';

UPDATE organization_access_roles
   SET name = 'Miembro',
       description = 'Participa en el trabajo: crea y actualiza tarjetas, y comenta.',
       updated_at = CURRENT_TIMESTAMP
 WHERE role_key = 'MEMBER'
   AND is_system = TRUE
   AND name = 'Colaborador';
