CREATE UNIQUE INDEX "project_epics_project_id_id_key" ON "project_epics"("project_id", "id");

CREATE TABLE "project_epic_cards" (
    "project_id" UUID NOT NULL,
    "epic_id" UUID NOT NULL,
    "card_id" UUID NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_epic_cards_pkey" PRIMARY KEY ("project_id", "card_id")
);

CREATE INDEX "project_epic_cards_epic_id_idx" ON "project_epic_cards"("epic_id");

ALTER TABLE "project_epic_cards"
    ADD CONSTRAINT "project_epic_cards_project_id_epic_id_fkey"
    FOREIGN KEY ("project_id", "epic_id") REFERENCES "project_epics"("project_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_epic_cards"
    ADD CONSTRAINT "project_epic_cards_card_id_fkey"
    FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "project_epic_cards" ("project_id", "epic_id", "card_id")
SELECT e."project_id", e."id", c."id"
FROM "cards" c
JOIN "project_epics" e ON e."id" = c."epic_id"
JOIN "lists" l ON l."id" = c."list_id"
JOIN "project_boards" pb ON pb."board_id" = l."board_id" AND pb."project_id" = e."project_id"
ON CONFLICT ("project_id", "card_id") DO NOTHING;

DROP INDEX "cards_epic_id_idx";
ALTER TABLE "cards" DROP CONSTRAINT "cards_epic_id_fkey";
ALTER TABLE "cards" DROP COLUMN "epic_id";
