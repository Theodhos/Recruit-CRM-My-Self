-- Data only (no table changes): the permission keys payroll:view and payroll:sensitive, and the five standard roles
-- (Administrator, Account Manager, Resourcer, Payroll Administrator, Marketing) for every organisation. Existing roles
-- are kept; "Admin" is renamed "Administrator". Commission percentages and payroll approval are taken away from every
-- role that is not meant to have them. Safe to run twice.

INSERT INTO "permissions" ("id", "key", "module", "description", "createdAt") VALUES
  ('perm_payroll_view', 'payroll:view', 'payroll', 'See timesheets, the weekly payroll, payslips and payment statuses', CURRENT_TIMESTAMP),
  ('perm_payroll_sensitive', 'payroll:sensitive', 'payroll', 'See and change workers'' NINO and UTR', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- the administrator role (anyone who manages users) gets every permission, including the two new ones
UPDATE "roles" r SET "name" = 'Administrator', "description" = 'Full access to everything, including users, roles, commission percentages and payroll approval.', "updatedAt" = CURRENT_TIMESTAMP
WHERE r."name" = 'Admin' AND NOT EXISTS (SELECT 1 FROM "roles" x WHERE x."organisationId" = r."organisationId" AND x."name" = 'Administrator');

INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT 'rp_adm_' || substr(md5(r."id" || p."id"), 1, 20), r."id", p."id", CURRENT_TIMESTAMP
FROM "roles" r JOIN "permissions" p ON p."key" IN ('payroll:view', 'payroll:sensitive', 'payroll:approve', 'commission:manage')
WHERE EXISTS (SELECT 1 FROM "role_permissions" rp JOIN "permissions" u ON u."id" = rp."permissionId" AND u."key" = 'users:manage' WHERE rp."roleId" = r."id")
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Account Manager
INSERT INTO "roles" ("id", "organisationId", "name", "description", "createdAt", "updatedAt")
SELECT 'role_' || substr(md5(o."id" || 'Account Manager'), 1, 20), o."id", 'Account Manager', 'Clients, vacancies, applications and the candidates assigned to them.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "organisations" o
ON CONFLICT ("organisationId", "name") DO NOTHING;

INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT 'rp_' || substr(md5(r."id" || p."id"), 1, 24), r."id", p."id", CURRENT_TIMESTAMP
FROM "roles" r JOIN "permissions" p ON p."key" LIKE ANY (ARRAY['company:%', 'contact:%', 'job:%', 'application:%', 'candidate:create', 'candidate:read', 'candidate:update', 'placement:read', 'task:%', 'document:%', 'activity:%', 'calendar:%', 'communication:send', 'notification:%']::text[])
WHERE r."name" = 'Account Manager'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Resourcer
INSERT INTO "roles" ("id", "organisationId", "name", "description", "createdAt", "updatedAt")
SELECT 'role_' || substr(md5(o."id" || 'Resourcer'), 1, 20), o."id", 'Resourcer', 'The candidate database, jobs and their own placements. Cannot see other people''s commission.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "organisations" o
ON CONFLICT ("organisationId", "name") DO NOTHING;

INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT 'rp_' || substr(md5(r."id" || p."id"), 1, 24), r."id", p."id", CURRENT_TIMESTAMP
FROM "roles" r JOIN "permissions" p ON p."key" LIKE ANY (ARRAY['candidate:create', 'candidate:read', 'candidate:update', 'candidate:export', 'job:create', 'job:read', 'job:update', 'application:%', 'placement:create', 'placement:read', 'placement:update', 'company:read', 'contact:read', 'task:%', 'document:%', 'activity:%', 'calendar:%', 'communication:send', 'communication:bulk', 'notification:%']::text[])
WHERE r."name" = 'Resourcer'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Payroll Administrator
INSERT INTO "roles" ("id", "organisationId", "name", "description", "createdAt", "updatedAt")
SELECT 'role_' || substr(md5(o."id" || 'Payroll Administrator'), 1, 20), o."id", 'Payroll Administrator', 'Timesheets, payroll, payslips and payment statuses. May approve payroll and see NINO and UTR.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "organisations" o
ON CONFLICT ("organisationId", "name") DO NOTHING;

INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT 'rp_' || substr(md5(r."id" || p."id"), 1, 24), r."id", p."id", CURRENT_TIMESTAMP
FROM "roles" r JOIN "permissions" p ON p."key" LIKE ANY (ARRAY['payroll:view', 'payroll:approve', 'payroll:sensitive', 'candidate:read', 'company:read', 'placement:read', 'document:create', 'document:read', 'notification:%']::text[])
WHERE r."name" = 'Payroll Administrator'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Marketing
INSERT INTO "roles" ("id", "organisationId", "name", "description", "createdAt", "updatedAt")
SELECT 'role_' || substr(md5(o."id" || 'Marketing'), 1, 20), o."id", 'Marketing', 'Website vacancies and marketing-related information.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "organisations" o
ON CONFLICT ("organisationId", "name") DO NOTHING;

INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT 'rp_' || substr(md5(r."id" || p."id"), 1, 24), r."id", p."id", CURRENT_TIMESTAMP
FROM "roles" r JOIN "permissions" p ON p."key" LIKE ANY (ARRAY['job:read', 'job:update', 'company:read', 'candidate:read', 'candidate:export', 'template:manage', 'communication:bulk', 'notification:%']::text[])
WHERE r."name" = 'Marketing'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

DELETE FROM "role_permissions" rp USING "permissions" p, "roles" r
WHERE rp."permissionId" = p."id" AND p."key" = 'commission:manage' AND rp."roleId" = r."id" AND r."name" NOT IN ('Administrator');

DELETE FROM "role_permissions" rp USING "permissions" p, "roles" r
WHERE rp."permissionId" = p."id" AND p."key" = 'payroll:approve' AND rp."roleId" = r."id" AND r."name" NOT IN ('Administrator', 'Payroll Administrator');

DELETE FROM "role_permissions" rp USING "permissions" p, "roles" r
WHERE rp."permissionId" = p."id" AND p."key" = 'payroll:view' AND rp."roleId" = r."id" AND r."name" NOT IN ('Administrator', 'Payroll Administrator');

DELETE FROM "role_permissions" rp USING "permissions" p, "roles" r
WHERE rp."permissionId" = p."id" AND p."key" = 'payroll:sensitive' AND rp."roleId" = r."id" AND r."name" NOT IN ('Administrator', 'Payroll Administrator');

