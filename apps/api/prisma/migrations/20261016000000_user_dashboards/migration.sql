CREATE TABLE "user_dashboards" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "context_type" VARCHAR(20) NOT NULL,
  "context_id" UUID,
  "widgets" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "locked" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_dashboards_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_dashboards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_dashboards_context_check" CHECK (
    ("context_type" = 'PERSONAL' AND "context_id" IS NULL)
    OR ("context_type" IN ('ORGANIZATION', 'WORKSPACE', 'PROJECT') AND "context_id" IS NOT NULL)
  )
);

CREATE INDEX "user_dashboards_user_id_created_at_idx" ON "user_dashboards"("user_id", "created_at");
