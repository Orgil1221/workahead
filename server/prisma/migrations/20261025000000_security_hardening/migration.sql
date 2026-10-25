-- Additive security rollout; existing account and exam data is retained.
BEGIN;

-- AlterTable
ALTER TABLE "EmailOtp" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "otpHash" TEXT,
ALTER COLUMN "otp" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "adminMfaVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "verifyOtpAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "verifyOtpHash" TEXT;

-- CreateTable
CREATE TABLE "AdminLoginOtp" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminLoginOtp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuthChallenge" (
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "credentialHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuthChallenge_pkey" PRIMARY KEY ("tokenHash")
);

-- CreateTable
CREATE TABLE "AdminTrustedDevice" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminTrustedDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminLoginOtp_email_key" ON "AdminLoginOtp"("email");

-- CreateIndex
CREATE INDEX "AdminAuthChallenge_userId_createdAt_idx" ON "AdminAuthChallenge"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuthChallenge_expiresAt_idx" ON "AdminAuthChallenge"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminTrustedDevice_tokenHash_key" ON "AdminTrustedDevice"("tokenHash");

-- CreateIndex
CREATE INDEX "AdminTrustedDevice_userId_idx" ON "AdminTrustedDevice"("userId");

-- CreateIndex
CREATE INDEX "AdminTrustedDevice_expiresAt_idx" ON "AdminTrustedDevice"("expiresAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_adminId_createdAt_idx" ON "AdminAuditLog"("adminId", "createdAt");

-- AddForeignKey
ALTER TABLE "AdminAuthChallenge" ADD CONSTRAINT "AdminAuthChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminTrustedDevice" ADD CONSTRAINT "AdminTrustedDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
