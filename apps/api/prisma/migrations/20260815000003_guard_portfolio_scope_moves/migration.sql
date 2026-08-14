-- A portfolio link locks its organizational scope. Moving a linked project,
-- workspace or portfolio to another organization requires removing the link
-- first, so a later UPDATE cannot invalidate the cross-tenant guarantee.

CREATE OR REPLACE FUNCTION prevent_linked_project_workspace_move()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM portfolio_projects WHERE project_id = OLD.id) THEN
    RAISE EXCEPTION 'remove portfolio links before moving a project between workspaces'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS projects_prevent_linked_workspace_move ON projects;
CREATE TRIGGER projects_prevent_linked_workspace_move
BEFORE UPDATE OF workspace_id ON projects
FOR EACH ROW
WHEN (OLD.workspace_id IS DISTINCT FROM NEW.workspace_id)
EXECUTE FUNCTION prevent_linked_project_workspace_move();

CREATE OR REPLACE FUNCTION prevent_portfolio_scope_move_with_links()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM portfolio_projects WHERE portfolio_id = OLD.id) THEN
    RAISE EXCEPTION 'remove portfolio links before moving a portfolio between organizations'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS portfolios_prevent_scope_move_with_links ON portfolios;
CREATE TRIGGER portfolios_prevent_scope_move_with_links
BEFORE UPDATE OF organization_id ON portfolios
FOR EACH ROW
WHEN (OLD.organization_id IS DISTINCT FROM NEW.organization_id)
EXECUTE FUNCTION prevent_portfolio_scope_move_with_links();

CREATE OR REPLACE FUNCTION prevent_workspace_scope_move_with_portfolio_projects()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM projects p
      JOIN portfolio_projects pp ON pp.project_id = p.id
     WHERE p.workspace_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'remove portfolio links before moving a workspace between organizations'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS workspaces_prevent_scope_move_with_portfolio_projects ON workspaces;
CREATE TRIGGER workspaces_prevent_scope_move_with_portfolio_projects
BEFORE UPDATE OF organization_id ON workspaces
FOR EACH ROW
WHEN (OLD.organization_id IS DISTINCT FROM NEW.organization_id)
EXECUTE FUNCTION prevent_workspace_scope_move_with_portfolio_projects();
