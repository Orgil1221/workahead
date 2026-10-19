BEGIN;

ALTER TABLE "ChatMessage" ADD COLUMN "mentions" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "ChatMessage" ADD COLUMN "replyToId" TEXT;
CREATE INDEX "ChatMessage_replyToId_idx" ON "ChatMessage"("replyToId");
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
