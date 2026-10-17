CREATE TYPE "FeedbackType" AS ENUM ('FEEDBACK', 'BUG');
CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'IN_REVIEW', 'RESOLVED');

CREATE TABLE "feedback_submissions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "type" "FeedbackType" NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "description" TEXT NOT NULL,
  "reproduction_steps" TEXT,
  "page_path" VARCHAR(500) NOT NULL DEFAULT '/dashboard',
  "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
  "handled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "feedback_submissions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "feedback_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "feedback_submissions_status_created_at_idx" ON "feedback_submissions"("status", "created_at");
CREATE INDEX "feedback_submissions_type_created_at_idx" ON "feedback_submissions"("type", "created_at");
CREATE INDEX "feedback_submissions_user_id_created_at_idx" ON "feedback_submissions"("user_id", "created_at");
