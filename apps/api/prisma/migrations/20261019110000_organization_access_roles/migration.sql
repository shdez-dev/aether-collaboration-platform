CREATE TABLE organization_access_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role_key VARCHAR(64) NOT NULL,
  name VARCHAR(60) NOT NULL,
  description VARCHAR(180) NOT NULL DEFAULT '',
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT organization_access_roles_org_key UNIQUE (organization_id, role_key)
);

CREATE INDEX organization_access_roles_org_sort_idx
  ON organization_access_roles(organization_id, sort_order, name);

ALTER TABLE project_members ALTER COLUMN role TYPE VARCHAR(64);
ALTER TABLE team_members ALTER COLUMN role TYPE VARCHAR(64);
ALTER TABLE team_invitations ALTER COLUMN role TYPE VARCHAR(64);

INSERT INTO organization_access_roles
  (organization_id, role_key, name, description, permissions, is_system, sort_order)
SELECT o.id, defaults.role_key, defaults.name, defaults.description, defaults.permissions, TRUE, defaults.sort_order
  FROM organizations o
 CROSS JOIN (VALUES
   (
     'ADMIN', 'Coordinador', 'Administra la configuración y el acceso del proyecto o equipo.', 0,
     '{"project.view":true,"project.manage":true,"members.manage":true,"boards.manage":true,"work.create":true,"work.edit":true,"work.delete":true,"work.comment":true,"planning.manage":true,"risks.manage":true,"documents.manage":true,"traceability.manage":true,"teams.manage":true}'::jsonb
   ),
   (
     'MEMBER', 'Colaborador', 'Participa en el trabajo y actualiza tarjetas sin administrar la configuración.', 1,
     '{"project.view":true,"project.manage":false,"members.manage":false,"boards.manage":false,"work.create":true,"work.edit":true,"work.delete":false,"work.comment":true,"planning.manage":false,"risks.manage":false,"documents.manage":false,"traceability.manage":false,"teams.manage":false}'::jsonb
   ),
   (
     'VIEWER', 'Observador', 'Consulta la información sin modificarla.', 2,
     '{"project.view":true,"project.manage":false,"members.manage":false,"boards.manage":false,"work.create":false,"work.edit":false,"work.delete":false,"work.comment":false,"planning.manage":false,"risks.manage":false,"documents.manage":false,"traceability.manage":false,"teams.manage":false}'::jsonb
   )
 ) AS defaults(role_key, name, description, sort_order, permissions)
 WHERE o.type <> 'PERSONAL'
ON CONFLICT (organization_id, role_key) DO NOTHING;
