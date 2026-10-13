CREATE TABLE "project_epics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(1000),
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_epics_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "cards"
    ADD COLUMN "acceptance_criteria" TEXT,
    ADD COLUMN "story_points" INTEGER,
    ADD COLUMN "epic_id" UUID;

CREATE UNIQUE INDEX "project_epics_project_id_name_key" ON "project_epics"("project_id", "name");
CREATE INDEX "project_epics_project_id_position_idx" ON "project_epics"("project_id", "position");
CREATE INDEX "cards_epic_id_idx" ON "cards"("epic_id");

ALTER TABLE "project_epics"
    ADD CONSTRAINT "project_epics_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cards"
    ADD CONSTRAINT "cards_epic_id_fkey"
    FOREIGN KEY ("epic_id") REFERENCES "project_epics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cards"
    ADD CONSTRAINT "cards_story_points_check"
    CHECK ("story_points" IS NULL OR "story_points" IN (1, 2, 3, 5, 8, 13, 21));
