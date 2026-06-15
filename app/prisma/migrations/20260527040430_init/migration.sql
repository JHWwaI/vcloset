-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "creditBalance" INTEGER NOT NULL DEFAULT 5,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ProfileImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProfileImage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Garment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'TOP',
    "name" TEXT,
    "color" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Garment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TryOnSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "profileImageId" TEXT NOT NULL,
    "garmentId" TEXT NOT NULL,
    "resultUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "cost" INTEGER NOT NULL DEFAULT 1,
    "durationMs" INTEGER,
    "cacheHit" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "TryOnSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TryOnSession_garmentId_fkey" FOREIGN KEY ("garmentId") REFERENCES "Garment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CreditLedger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "balanceAfter" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreditLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "ProfileImage_userId_idx" ON "ProfileImage"("userId");

-- CreateIndex
CREATE INDEX "Garment_userId_idx" ON "Garment"("userId");

-- CreateIndex
CREATE INDEX "Garment_userId_category_idx" ON "Garment"("userId", "category");

-- CreateIndex
CREATE INDEX "TryOnSession_userId_createdAt_idx" ON "TryOnSession"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "TryOnSession_status_idx" ON "TryOnSession"("status");

-- CreateIndex
CREATE INDEX "CreditLedger_userId_createdAt_idx" ON "CreditLedger"("userId", "createdAt");
