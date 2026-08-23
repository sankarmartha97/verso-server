# verso-server (Phase 0)

Plain Express, plain JavaScript — no decorators, no transpilation step. Currently:
a `/health` endpoint that also pings Postgres.

## Run
    cp .env.example .env
    docker compose up -d       # Postgres, Redis, MinIO, Mailhog
    npm install
    npm run start:dev          # http://localhost:3000/health

`src/main.js` boots `src/app.js` directly with `node` — Express needs no build step,
so there's no `run.js`/Babel indirection to worry about.

## Module anatomy
Each domain under `src/modules/` follows: `*.module.js` (wires an Express `Router`
and mounts controller handlers), `*.controller.js` (request handlers), `*.service.js`
(business logic), `*.repository.js` (DB access — extends
`src/infra/postgres/base.repository.js` for shared CRUD). Logic never touches the DB
directly; it goes through the repository.

## Next (Phase 1)
Add `config/`, `infra/redis`, `auth` + `users` modules (their repositories extend
`BaseRepository`). See `../devkit/EXECUTION-PLAN.md`.
