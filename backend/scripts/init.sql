-- This script initializes the PostgreSQL schema for the SGMS backend.
-- It defines all tables, custom types, and triggers.

-- Drop existing tables and types for a clean re-initialization.
DROP TABLE IF EXISTS "Attachments" CASCADE;
DROP TABLE IF EXISTS "Reports" CASCADE;
DROP TABLE IF EXISTS "SystemSettings" CASCADE;
DROP TABLE IF EXISTS "Activities" CASCADE;
DROP TABLE IF EXISTS "Tasks" CASCADE;
DROP TABLE IF EXISTS "Goals" CASCADE;
DROP TABLE IF EXISTS "UserGroups" CASCADE;
DROP TABLE IF EXISTS "RolePermissions" CASCADE;
DROP TABLE IF EXISTS "Users" CASCADE;
DROP TABLE IF EXISTS "Permissions" CASCADE;
DROP TABLE IF EXISTS "Roles" CASCADE;
DROP TABLE IF EXISTS "Groups" CASCADE;

DROP TYPE IF EXISTS goal_status, task_status, activity_status, report_status;

-- ENUM TYPES: Enums provide data consistency for status fields.
CREATE TYPE goal_status AS ENUM ('Not Started', 'In Progress', 'Completed', 'On Hold');
CREATE TYPE task_status AS ENUM ('To Do', 'In Progress', 'Done', 'Blocked');
CREATE TYPE activity_status AS ENUM ('To Do', 'In Progress', 'Done');
CREATE TYPE report_status AS ENUM ('Pending', 'Approved', 'Rejected');

-- ROLES & PERMISSIONS
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
    "roleId" INTEGER REFERENCES "Roles"("id") ON DELETE SET NULL, -- SET NULL to keep user if role is deleted.
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

-- GROUPS
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

-- GOALS, TASKS, ACTIVITIES
CREATE TABLE "Goals" (
    "id" SERIAL PRIMARY KEY,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "groupId" INTEGER REFERENCES "Groups"(id) ON DELETE SET NULL,
    "startDate" DATE,
    "endDate" DATE,
    "status" goal_status NOT NULL DEFAULT 'Not Started',
    "progress" INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Index for faster lookup by group and status
CREATE INDEX idx_goals_group_status ON "Goals" ("groupId", "status");

CREATE TABLE "Tasks" (
    "id" SERIAL PRIMARY KEY,
    "goalId" INTEGER NOT NULL REFERENCES "Goals"("id") ON DELETE CASCADE,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" task_status NOT NULL DEFAULT 'To Do',
    "assigneeId" INTEGER REFERENCES "Users"("id") ON DELETE SET NULL, -- SET NULL to keep task if user is deleted.
    "dueDate" DATE,
    "progress" INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Indexes for faster lookup by goal and assignee
CREATE INDEX idx_tasks_goal_id ON "Tasks" ("goalId");
CREATE INDEX idx_tasks_assignee_id ON "Tasks" ("assigneeId");

CREATE TABLE "Activities" (
    "id" SERIAL PRIMARY KEY,
    "taskId" INTEGER NOT NULL REFERENCES "Tasks"("id") ON DELETE CASCADE,
    "parentId" INTEGER REFERENCES "Activities"("id") ON DELETE CASCADE, -- For sub-activities.
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" activity_status NOT NULL DEFAULT 'To Do',
    "dueDate" DATE,
    "metrics" JSONB, -- The new column for flexible metrics data
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Indexes for faster lookup by task and parent
CREATE INDEX idx_activities_task_id ON "Activities" ("taskId");
CREATE INDEX idx_activities_parent_id ON "Activities" ("parentId");

-- NEW TABLE FOR SYSTEM-WIDE SETTINGS
CREATE TABLE "SystemSettings" (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT,
    description TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- REPORTING & ATTACHMENTS
CREATE TABLE "Reports" (
    "id" SERIAL PRIMARY KEY,
    "activityId" INT NOT NULL REFERENCES "Activities"(id) ON DELETE CASCADE,
    "userId" INT REFERENCES "Users"(id) ON DELETE SET NULL,
    "narrative" TEXT,
    "metrics_data" JSONB,
    "new_status" VARCHAR(50),
    "status" report_status NOT NULL DEFAULT 'Pending',
    "adminComment" TEXT,
    "resubmissionDeadline" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helpful index for fast lookups
CREATE INDEX idx_reports_userId ON "Reports" ("userId");
CREATE INDEX idx_reports_activityId ON "Reports" ("activityId");

CREATE TABLE "Attachments" (
    "id" SERIAL PRIMARY KEY,
    "reportId" INT NOT NULL REFERENCES "Reports"(id) ON DELETE CASCADE,
    "fileName" VARCHAR(255) NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileType" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helpful index for fast lookups
CREATE INDEX idx_attachments_reportId ON "Attachments" ("reportId");

-- TRIGGERS: Automatically update the "updatedAt" column on modification.
CREATE OR REPLACE FUNCTION update_updatedAt_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach triggers to all tables, including the new ones
CREATE TRIGGER set_updatedAt_Roles BEFORE UPDATE ON "Roles" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
CREATE TRIGGER set_updatedAt_Permissions BEFORE UPDATE ON "Permissions" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
CREATE TRIGGER set_updatedAt_Users BEFORE UPDATE ON "Users" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
CREATE TRIGGER set_updatedAt_RolePermissions BEFORE UPDATE ON "RolePermissions" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
CREATE TRIGGER set_updatedAt_Groups BEFORE UPDATE ON "Groups" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
CREATE TRIGGER set_updatedAt_UserGroups BEFORE UPDATE ON "UserGroups" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
CREATE TRIGGER set_updatedAt_Goals BEFORE UPDATE ON "Goals" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
CREATE TRIGGER set_updatedAt_Tasks BEFORE UPDATE ON "Tasks" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
CREATE TRIGGER set_updatedAt_Activities BEFORE UPDATE ON "Activities" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
CREATE TRIGGER set_updatedAt_SystemSettings BEFORE UPDATE ON "SystemSettings" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
CREATE TRIGGER set_updatedAt_Reports BEFORE UPDATE ON "Reports" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
-- Note: Attachments does not need a trigger since it only has a createdAt column.