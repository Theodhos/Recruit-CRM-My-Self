-- Additive only: resourcers per placement (one or two, split %), commission rate and basis per person, the organisation default basis, commission payments, and the commission:manage permission.
-- CreateEnum
CREATE TYPE "CommissionBasis" AS ENUM ('PROFIT', 'BILLING');

-- AlterTable
ALTER TABLE "organisations" ADD COLUMN     "commissionBasis" "CommissionBasis" NOT NULL DEFAULT 'PROFIT';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "commissionBasis" "CommissionBasis",
ADD COLUMN     "commissionRate" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "placement_resourcers" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "placementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "splitPercent" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "placement_resourcers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_payments" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "placement_resourcers_organisationId_userId_idx" ON "placement_resourcers"("organisationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "placement_resourcers_placementId_userId_key" ON "placement_resourcers"("placementId", "userId");

-- CreateIndex
CREATE INDEX "commission_payments_organisationId_month_idx" ON "commission_payments"("organisationId", "month");

-- AddForeignKey
ALTER TABLE "placement_resourcers" ADD CONSTRAINT "placement_resourcers_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_resourcers" ADD CONSTRAINT "placement_resourcers_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "placements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_resourcers" ADD CONSTRAINT "placement_resourcers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_payments" ADD CONSTRAINT "commission_payments_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_payments" ADD CONSTRAINT "commission_payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Only people who manage users (administrators) may set resourcers, commission rates and record commission payments.
INSERT INTO "permissions" ("id", "key", "module", "description", "createdAt") VALUES ('perm_commission_manage', 'commission:manage', 'commission', 'Set resourcers, commission rates and record commission payments', CURRENT_TIMESTAMP) ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT 'rp_com_' || substr(md5(rp."roleId" || p."id"), 1, 20), rp."roleId", p."id", CURRENT_TIMESTAMP
FROM "role_permissions" rp
JOIN "permissions" src ON src."id" = rp."permissionId" AND src."key" = 'users:manage'
JOIN "permissions" p ON p."key" = 'commission:manage'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
