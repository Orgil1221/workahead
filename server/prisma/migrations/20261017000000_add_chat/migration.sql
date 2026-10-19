CREATE TABLE "ChatProfile" (
    "userId" TEXT NOT NULL,
    "selectedBadge" TEXT,
    "badgeColor" TEXT NOT NULL DEFAULT 'orange',
    "allowInvites" BOOLEAN NOT NULL DEFAULT true,
    "muted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ChatProfile_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "ChatRoom" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'DIRECT',
    "pairKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatRoom_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatMember" (
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMember_pkey" PRIMARY KEY ("roomId","userId")
);

CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatInvite" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "pairKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "roomId" TEXT,

    CONSTRAINT "ChatInvite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatBlock" (
    "userId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatBlock_pkey" PRIMARY KEY ("userId","blockedId")
);

CREATE TABLE "ChatSavedMessage" (
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatSavedMessage_pkey" PRIMARY KEY ("userId","messageId")
);

CREATE TABLE "ChatReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChatRoom_pairKey_key" ON "ChatRoom"("pairKey");

CREATE INDEX "ChatMember_userId_idx" ON "ChatMember"("userId");

CREATE INDEX "ChatMessage_roomId_createdAt_id_idx" ON "ChatMessage"("roomId", "createdAt", "id");

CREATE UNIQUE INDEX "ChatMessage_userId_clientId_key" ON "ChatMessage"("userId", "clientId");

CREATE UNIQUE INDEX "ChatInvite_pairKey_key" ON "ChatInvite"("pairKey");

CREATE UNIQUE INDEX "ChatInvite_roomId_key" ON "ChatInvite"("roomId");

CREATE INDEX "ChatInvite_recipientId_status_idx" ON "ChatInvite"("recipientId", "status");

CREATE INDEX "ChatInvite_senderId_createdAt_idx" ON "ChatInvite"("senderId", "createdAt");

CREATE INDEX "ChatBlock_blockedId_idx" ON "ChatBlock"("blockedId");

CREATE INDEX "ChatReport_resolved_createdAt_idx" ON "ChatReport"("resolved", "createdAt");

CREATE UNIQUE INDEX "ChatReport_userId_messageId_key" ON "ChatReport"("userId", "messageId");

ALTER TABLE "ChatProfile" ADD CONSTRAINT "ChatProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatMember" ADD CONSTRAINT "ChatMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatMember" ADD CONSTRAINT "ChatMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatInvite" ADD CONSTRAINT "ChatInvite_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatInvite" ADD CONSTRAINT "ChatInvite_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatInvite" ADD CONSTRAINT "ChatInvite_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ChatBlock" ADD CONSTRAINT "ChatBlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatBlock" ADD CONSTRAINT "ChatBlock_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatSavedMessage" ADD CONSTRAINT "ChatSavedMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatSavedMessage" ADD CONSTRAINT "ChatSavedMessage_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatReport" ADD CONSTRAINT "ChatReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatReport" ADD CONSTRAINT "ChatReport_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;


INSERT INTO "ChatRoom" ("id", "kind") VALUES ('all', 'PUBLIC') ON CONFLICT ("id") DO NOTHING;
