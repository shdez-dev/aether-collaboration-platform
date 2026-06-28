-- Migration: add buffer_days to cards
ALTER TABLE "cards" ADD COLUMN "buffer_days" INTEGER;
