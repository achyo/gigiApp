ALTER TABLE "categories"
ADD COLUMN "color" TEXT NOT NULL DEFAULT '#1A5FD4';

ALTER TABLE "user_preferences"
ADD COLUMN "list_layouts" JSONB;