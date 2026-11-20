-- Additive only: Dialpad calls/SMS history, bulk-send batches, message templates, and the three new permissions.
-- Nothing existing is altered or dropped.
CREATE TYPE "CommunicationType" AS ENUM ('CALL', 'SMS');
CREATE TYPE "CommunicationDirection" AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE "CommunicationStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'UNDELIVERED', 'FAILED', 'RECEIVED', 'RINGING', 'CONNECTED', 'COMPLETED', 'MISSED', 'NO_ANSWER');
CREATE TYPE "CommunicationBatchStatus" AS ENUM ('RUNNING', 'COMPLETED', 'COMPLETED_WITH_ERRORS');

CREATE TABLE "communication_batches" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "template" TEXT NOT NULL,
  "status" "CommunicationBatchStatus" NOT NULL DEFAULT 'RUNNING',
  "matching" INTEGER NOT NULL DEFAULT 0,
  "eligible" INTEGER NOT NULL DEFAULT 0,
  "excluded" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "communication_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "communications" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "candidateId" TEXT,
  "type" "CommunicationType" NOT NULL,
  "direction" "CommunicationDirection" NOT NULL,
  "status" "CommunicationStatus" NOT NULL,
  "body" TEXT,
  "externalNumber" TEXT NOT NULL,
  "fromNumber" TEXT,
  "userId" TEXT,
  "provider" TEXT NOT NULL DEFAULT 'dialpad',
  "providerId" TEXT,
  "providerStatus" TEXT,
  "errorMessage" TEXT,
  "durationSeconds" INTEGER,
  "lastEventAt" TIMESTAMP(3),
  "batchId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "communications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "message_templates" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "communication_batches_organisationId_idempotencyKey_key" ON "communication_batches"("organisationId", "idempotencyKey");
CREATE INDEX "communication_batches_organisationId_createdAt_idx" ON "communication_batches"("organisationId", "createdAt" DESC);
CREATE UNIQUE INDEX "communications_organisationId_provider_providerId_key" ON "communications"("organisationId", "provider", "providerId");
CREATE INDEX "communications_organisationId_candidateId_createdAt_idx" ON "communications"("organisationId", "candidateId", "createdAt" DESC);
CREATE INDEX "communications_organisationId_externalNumber_idx" ON "communications"("organisationId", "externalNumber");
CREATE INDEX "communications_batchId_status_idx" ON "communications"("batchId", "status");
CREATE INDEX "communications_organisationId_createdAt_idx" ON "communications"("organisationId", "createdAt" DESC);
CREATE UNIQUE INDEX "message_templates_organisationId_name_key" ON "message_templates"("organisationId", "name");

ALTER TABLE "communication_batches" ADD CONSTRAINT "communication_batches_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "communication_batches" ADD CONSTRAINT "communication_batches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "communications" ADD CONSTRAINT "communications_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "communications" ADD CONSTRAINT "communications_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "communications" ADD CONSTRAINT "communications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "communications" ADD CONSTRAINT "communications_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "communication_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- New permissions; anyone who may already edit candidates keeps working with them (admins can narrow this per role).
INSERT INTO "permissions" ("id", "key", "module", "description", "createdAt") VALUES
  ('perm_communication_send', 'communication:send', 'communication', 'Call and text candidates through Dialpad', CURRENT_TIMESTAMP),
  ('perm_communication_bulk', 'communication:bulk', 'communication', 'Send bulk text messages', CURRENT_TIMESTAMP),
  ('perm_template_manage', 'template:manage', 'communication', 'Create, edit and delete message templates', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT 'rp_' || replace(p."key", ':', '_') || '_' || rp."roleId", rp."roleId", p."id", CURRENT_TIMESTAMP
FROM "role_permissions" rp
JOIN "permissions" src ON src."id" = rp."permissionId" AND src."key" = 'candidate:update'
JOIN "permissions" p ON p."key" IN ('communication:send', 'communication:bulk', 'template:manage')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
