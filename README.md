# verso-server (Phase 0)

NestJS in **plain JavaScript** (Babel decorators). Currently: a `/health` endpoint.

## Run
    cp .env.example .env
    npm install
    npm run start:dev      # http://localhost:3000/health

`run.js` registers Babel (so decorators work) then boots `src/main.js`.
For production: `npm run build` (babel -> dist) then `npm start`.

## Why run.js / babel.config.js
Nest relies on decorators, which aren't standard JS. babel.config.js enables
`@babel/plugin-proposal-decorators` (version: legacy) + class-properties +
transform-typescript-metadata (for DI). This combo is verified working.

## Next (Phase 1)
Add config/, infra/postgres + redis, auth + users modules. See EXECUTION-PLAN.md.
