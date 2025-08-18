-- =================================================================
-- DROP TABLES (in dependency order)
-- =================================================================
DROP TABLE IF EXISTS "Attachments";
DROP TABLE IF EXISTS "Reports";
DROP TABLE IF EXISTS "Activities";
DROP TABLE IF EXISTS "Tasks";
DROP TABLE IF EXISTS "Goals";
DROP TABLE IF EXISTS "SystemSettings";
DROP TABLE IF EXISTS "RolePermissions";
DROP TABLE IF EXISTS "UserGroups";
DROP TABLE IF EXISTS "Users";
DROP TABLE IF EXISTS "Permissions";
DROP TABLE IF EXISTS "Roles";
DROP TABLE IF EXISTS "Groups";

DROP TYPE IF EXISTS goal_status, task_status, activity_status, report_status;

-- =================================================================
-- ENUM TYPES
-- =================================================================
CREATE TYPE goal_status AS ENUM ('Not Started', 'In Progress', 'Completed', 'On Hold');
CREATE TYPE task_status AS ENUM ('To Do', 'In Progress', 'Done', 'Blocked');
CREATE TYPE activity_status AS ENUM ('To Do', 'In Progress', 'Done');
CREATE TYPE report_status AS ENUM ('Pending', 'Approved', 'Rejected');

-- =================================================================
-- ROLES & PERMISSIONS
-- =================================================================
CREATE TABLE "Roles" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL UNIQUE,
  "description" VARCHAR(255),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "Permissions" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL UNIQUE,
  "description" VARCHAR(255),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "Users" (
  "id" SERIAL PRIMARY KEY,
  "username" VARCHAR(255) NOT NULL UNIQUE,
  "name" VARCHAR(255),
  "password" VARCHAR(255) NOT NULL,
  "roleId" INTEGER REFERENCES "Roles"("id") ON DELETE SET NULL,
  "language" VARCHAR(10) DEFAULT 'en',
  "darkMode" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "RolePermissions" (
  "id" SERIAL PRIMARY KEY,
  "roleId" INTEGER NOT NULL REFERENCES "Roles"("id") ON DELETE CASCADE,
  "permissionId" INTEGER NOT NULL REFERENCES "Permissions"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("roleId", "permissionId")
);

-- =================================================================
-- GROUPS
-- =================================================================
CREATE TABLE "Groups" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL UNIQUE,
  "description" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "UserGroups" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
  "groupId" INTEGER NOT NULL REFERENCES "Groups"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("userId", "groupId")
);

-- =================================================================
-- GOALS, TASKS, ACTIVITIES
-- =================================================================
CREATE TABLE "Goals" (
  "id" SERIAL PRIMARY KEY,
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "groupId" INTEGER REFERENCES "Groups"("id") ON DELETE SET NULL,
  "startDate" DATE,
  "endDate" DATE,
  "status" goal_status NOT NULL DEFAULT 'Not Started',
  "progress" INTEGER NOT NULL DEFAULT 0 CHECK ("progress" BETWEEN 0 AND 100),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "Tasks" (
  "id" SERIAL PRIMARY KEY,
  "goalId" INTEGER NOT NULL REFERENCES "Goals"("id") ON DELETE CASCADE,
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "status" task_status NOT NULL DEFAULT 'To Do',
  "assigneeId" INTEGER REFERENCES "Users"("id") ON DELETE SET NULL,
  "dueDate" DATE,
  "progress" INTEGER NOT NULL DEFAULT 0 CHECK ("progress" BETWEEN 0 AND 100),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "Activities" (
  "id" SERIAL PRIMARY KEY,
  "taskId" INTEGER NOT NULL REFERENCES "Tasks"("id") ON DELETE CASCADE,
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "status" activity_status NOT NULL DEFAULT 'To Do',
  "metrics" JSONB,
  "groupId" INTEGER REFERENCES "Groups"("id") ON DELETE SET NULL,
  "dueDate" DATE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =================================================================
-- REPORTING, ATTACHMENTS, SYSTEM SETTINGS
-- =================================================================
CREATE TABLE "Reports" (
  "id" SERIAL PRIMARY KEY,
  "activityId" INTEGER NOT NULL REFERENCES "Activities"("id") ON DELETE CASCADE,
  "userId" INTEGER NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
  "narrative" TEXT NOT NULL,
  "metrics_data" JSONB,
  "status" report_status NOT NULL DEFAULT 'Pending',
  "adminComment" TEXT,
  "resubmissionDeadline" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "Attachments" (
  "id" SERIAL PRIMARY KEY,
  "reportId" INTEGER REFERENCES "Reports"("id") ON DELETE CASCADE,
  "fileName" VARCHAR(255) NOT NULL,
  "filePath" VARCHAR(255) NOT NULL,
  "fileType" VARCHAR(100) NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "SystemSettings" (
  "id" SERIAL PRIMARY KEY,
  "key" VARCHAR(255) NOT NULL UNIQUE,
  "value" TEXT,
  "description" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =================================================================
-- TRIGGERS FOR updatedAt
-- =================================================================
CREATE OR REPLACE FUNCTION update_updatedAt_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach triggers
CREATE TRIGGER set_updatedAt_Roles BEFORE UPDATE ON "Roles" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
CREATE TRIGGER set_updatedAt_Permissions BEFORE UPDATE ON "Permissions" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
CREATE TRIGGER set_updatedAt_Users BEFORE UPDATE ON "Users" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
CREATE TRIGGER set_updatedAt_RolePermissions BEFORE UPDATE ON "RolePermissions" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
CREATE TRIGGER set_updatedAt_Groups BEFORE UPDATE ON "Groups" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
CREATE TRIGGER set_updatedAt_UserGroups BEFORE UPDATE ON "UserGroups" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
CREATE TRIGGER set_updatedAt_Goals BEFORE UPDATE ON "Goals" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
CREATE TRIGGER set_updatedAt_Tasks BEFORE UPDATE ON "Tasks" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
CREATE TRIGGER set_updatedAt_Activities BEFORE UPDATE ON "Activities" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
CREATE TRIGGER set_updatedAt_Reports BEFORE UPDATE ON "Reports" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
CREATE TRIGGER set_updatedAt_Attachments BEFORE UPDATE ON "Attachments" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
CREATE TRIGGER set_updatedAt_SystemSettings BEFORE UPDATE ON "SystemSettings" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
