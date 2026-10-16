CREATE TABLE "UsageMinute" (
    "userId" TEXT NOT NULL,
    "minuteAt" TIMESTAMP(3) NOT NULL,
    "secondsMask" BIGINT NOT NULL,
    CONSTRAINT "UsageMinute_pkey" PRIMARY KEY ("userId", "minuteAt"),
    CONSTRAINT "UsageMinute_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "UsageMinute_minuteAt_idx" ON "UsageMinute"("minuteAt");
