-- Migration: add milestone_id to cards
ALTER TABLE "cards" ADD COLUMN "milestone_id" UUID;

ALTER TABLE "cards"
  ADD CONSTRAINT "cards_milestone_id_fkey"
  FOREIGN KEY ("milestone_id") REFERENCES "project_milestones"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
