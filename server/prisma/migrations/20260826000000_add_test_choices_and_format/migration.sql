-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "choices" JSONB,
ADD COLUMN     "correctChoice" TEXT;

-- AlterTable
ALTER TABLE "TestAttempt" ADD COLUMN     "format" TEXT NOT NULL DEFAULT 'OPEN';
