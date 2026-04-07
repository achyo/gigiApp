ALTER TABLE "assignments"
ADD COLUMN "current_object_id" TEXT,
ADD COLUMN "current_level" TEXT,
ADD COLUMN "current_exercise" TEXT,
ADD COLUMN "started_at" TIMESTAMP(3),
ADD COLUMN "progress_updated_at" TIMESTAMP(3);

CREATE TABLE "assignment_step_progress" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "activity_object_id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "exercise" TEXT NOT NULL,
    "time_ms" INTEGER,
    "comment" TEXT,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignment_step_progress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "assignment_step_progress_assignment_id_activity_object_id_level__key"
ON "assignment_step_progress"("assignment_id", "activity_object_id", "level", "exercise");

CREATE INDEX "assignment_step_progress_assignment_id_completed_at_idx"
ON "assignment_step_progress"("assignment_id", "completed_at");

ALTER TABLE "assignment_step_progress"
ADD CONSTRAINT "assignment_step_progress_assignment_id_fkey"
FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assignment_step_progress"
ADD CONSTRAINT "assignment_step_progress_activity_object_id_fkey"
FOREIGN KEY ("activity_object_id") REFERENCES "activity_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;