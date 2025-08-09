-- Drop tables in order of dependency to make the script re-runnable
DROP TABLE IF EXISTS "Activities";
DROP TABLE IF EXISTS "Tasks";
DROP TABLE IF EXISTS "Goals";
DROP TABLE IF EXISTS "RolePermissions";
DROP TABLE IF EXISTS "Users";
DROP TABLE IF EXISTS "Permissions";
DROP TABLE IF EXISTS "Roles";
DROP TYPE IF EXISTS goal_status;
DROP TYPE IF EXISTS task_status;
DROP TYPE IF EXISTS activity_status;

-- Create Custom Types
CREATE TYPE goal_status AS ENUM ('Not Started', 'In Progress', 'Completed', 'On Hold');
CREATE TYPE task_status AS ENUM ('To Do', 'In Progress', 'Done', 'Blocked');
CREATE TYPE activity_status AS ENUM ('To Do', 'In Progress', 'Done');

-- Create Roles Table
CREATE TABLE "Roles" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL UNIQUE,
  "description" VARCHAR(255),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create Permissions Table
CREATE TABLE "Permissions" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL UNIQUE,
  "description" VARCHAR(255),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create Users Table
CREATE TABLE "Users" (
  "id" SERIAL PRIMARY KEY,
  "username" VARCHAR(255) NOT NULL UNIQUE,
  "name" VARCHAR(255),
  "password" VARCHAR(255) NOT NULL,
  "roleId" INTEGER REFERENCES "Roles"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create RolePermissions Join Table
CREATE TABLE "RolePermissions" (
  "id" SERIAL PRIMARY KEY,
  "roleId" INTEGER NOT NULL REFERENCES "Roles"("id") ON DELETE CASCADE,
  "permissionId" INTEGER NOT NULL REFERENCES "Permissions"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("roleId", "permissionId")
);

-- Create Goals Table
CREATE TABLE "Goals" (
  "id" SERIAL PRIMARY KEY,
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "ownerId" INTEGER NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
  "startDate" DATE,
  "endDate" DATE,
  "status" goal_status NOT NULL DEFAULT 'Not Started',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create Tasks Table
CREATE TABLE "Tasks" (
    "id" SERIAL PRIMARY KEY,
    "goalId" INTEGER NOT NULL REFERENCES "Goals"("id") ON DELETE CASCADE,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" task_status NOT NULL DEFAULT 'To Do',
    "assigneeId" INTEGER REFERENCES "Users"("id") ON DELETE SET NULL,
    "dueDate" DATE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create Activities Table
CREATE TABLE "Activities" (
    "id" SERIAL PRIMARY KEY,
    "taskId" INTEGER NOT NULL REFERENCES "Tasks"("id") ON DELETE CASCADE,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" activity_status NOT NULL DEFAULT 'To Do',
    "dueDate" DATE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);