BEGIN;

ALTER TABLE "ChatProfile" ADD COLUMN "hasVisited" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ChatRoom" ADD COLUMN "pinnedMessageId" TEXT;
CREATE UNIQUE INDEX "ChatRoom_pinnedMessageId_key" ON "ChatRoom"("pinnedMessageId");
ALTER TABLE "ChatRoom" ADD CONSTRAINT "ChatRoom_pinnedMessageId_fkey" FOREIGN KEY ("pinnedMessageId") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
