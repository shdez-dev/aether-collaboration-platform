-- Drop old pivot table (project_workspaces)
DROP TABLE IF EXISTS "project_workspaces";

-- Clear projects (new feature, no real data yet — workspaceId is required going forward)
DELETE FROM "project_milestones";
DELETE FROM "projects";

-- Add workspace_id to projects
ALTER TABLE "projects" ADD COLUMN "workspace_id" UUID NOT NULL DEFAULT gen_random_uuid();

-- Remove the DEFAULT now that table is empty
ALTER TABLE "projects" ALTER COLUMN "workspace_id" DROP DEFAULT;

-- Add FK: projects -> workspaces
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create project_boards pivot
CREATE TABLE "project_boards" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "board_id" UUID NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_boards_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "project_boards" ADD CONSTRAINT "project_boards_project_id_board_id_key" UNIQUE ("project_id", "board_id");

ALTER TABLE "project_boards" ADD CONSTRAINT "project_boards_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
