# SGMS (Project)

Overview

SGMS is a full-stack application with a Node.js/Express backend and a React (Vite) frontend. The repository includes Docker definitions for local development with Postgres, plus helper scripts for DB migrations and seeding.

Primary folders

- backend/: Express API server, DB access, routes, services, and scripts.
- frontend/: Vite + React frontend (TailwindCSS).
- docker/: Helper Docker assets (if used separately).
- uploads/: Uploaded files used by app in development.
- docker-compose.yml: Development compose file (db, server, web)

Quick start (using Docker Compose)

1. Copy or create an `.env` with the required environment variables (see "Environment variables" below).
2. From project root, run:

```bash
docker compose up --build
```

This will build/run Postgres, the backend (server) and the frontend (web). The backend performs migrations and seeds on startup (see `docker-compose.yml` server command).

Backend (development)

- Files: [backend/](backend/)
- Entry: [backend/src/server.js](backend/src/server.js)
- Scripts (in [backend/package.json](backend/package.json)):
  - `dev`: nodemon src/server.js
  - `start`: node src/server.js
  - `migrate`: node src/scripts/migrate.js
  - `seed`: node src/scripts/seed.js

To run backend locally (not in Docker):

```bash
cd backend
npm install
npm run dev
```

Frontend (development)

- Files: [frontend/](frontend/)
- Entry: [frontend/src/main.jsx](frontend/src/main.jsx)
- Scripts (in [frontend/package.json](frontend/package.json)):
  - `dev`: vite
  - `build`: vite build
  - `preview`: vite preview

To run frontend locally:

```bash
cd frontend
npm install
npm run dev
```

Environment variables

Use [backend/.env](backend/.env) as a reference. Key variables include:

- `DATABASE_URL` — Postgres connection string used by the backend.
- `PORT` — Backend port (default 5000).
- `FRONTEND_ORIGIN` — Comma-separated allowed frontend origins (CORS).
- `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_ISSUER` — JWT settings.
- `ADMIN_USERNAME`, `ADMIN_PASSWORD` — Default admin used by seed script.
- `UPLOAD_DIR`, `MAX_UPLOAD_MB` — File upload config.
- `ADVISORY_LOCK_KEY` — Used by scheduled jobs.

Notes: Do NOT commit secrets to source control. Keep a `.env.example` (without secrets) in repo instead.

Database

- The project uses Postgres (see `docker-compose.yml`).
- DB helper: [backend/src/db.js](backend/src/db.js) exports `query`, `connect` and `tx` helpers.
- Migration and seed scripts are in [backend/src/scripts/](backend/src/scripts/).

Socket / Real-time

- Socket initialization: [backend/src/services/socketService.js](backend/src/services/socketService.js)
- The frontend connects with socket.io-client.

Jobs

- Monthly snapshot job located at [backend/src/jobs/monthlySnapshot.js](backend/src/jobs/monthlySnapshot.js) and scheduled in server startup.

File uploads

- Uploaded files are stored in `uploads/` by default. Upload handling is in [backend/src/middleware/uploadMiddleware.js](backend/src/middleware/uploadMiddleware.js) and services/uploadService.js.

Testing

- The backend has `jest` and `supertest` in devDependencies, but no `test` script defined. Consider adding `test` script in [backend/package.json](backend/package.json) to run unit/integration tests.

Linting & Formatting

- Frontend uses `eslint` and Tailwind. Add/enable linting scripts or CI checks as needed.

Common commands

- Build frontend: `cd frontend && npm run build`
- Start backend: `cd backend && npm start`
- Run migrations: `cd backend && npm run migrate`
- Seed DB: `cd backend && npm run seed`

Useful file references

- [docker-compose.yml](docker-compose.yml)
- [backend/package.json](backend/package.json)
- [frontend/package.json](frontend/package.json)
- [backend/src/server.js](backend/src/server.js)
- [backend/src/db.js](backend/src/db.js)
- [backend/.env](backend/.env)

License / Next steps

- Add a `.env.example` and remove real secrets from the repo.
- Add a `test` script and CI pipeline for running tests and linting.
