-- CreateTable: project_members (direct user-project membership)
CREATE TABLE "project_members" (
    "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID        NOT NULL,
    "user_id"    UUID        NOT NULL,
    "role"       VARCHAR(20) NOT NULL DEFAULT 'MEMBER',
    "added_by"   UUID,
    "added_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "project_members"
    ADD CONSTRAINT "project_members_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_members"
    ADD CONSTRAINT "project_members_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "project_members_project_id_user_id_key" ON "project_members"("project_id", "user_id");
CREATE INDEX "project_members_project_id_idx" ON "project_members"("project_id");
