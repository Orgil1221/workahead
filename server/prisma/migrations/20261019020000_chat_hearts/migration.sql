BEGIN;

CREATE TABLE "ChatHeart" (
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatHeart_pkey" PRIMARY KEY ("userId", "messageId")
);

CREATE INDEX "ChatHeart_messageId_idx" ON "ChatHeart"("messageId");

ALTER TABLE "ChatHeart" ADD CONSTRAINT "ChatHeart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatHeart" ADD CONSTRAINT "ChatHeart_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
