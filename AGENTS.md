# AGENTS.md

## Repository layout

- `two-rooms-and-a-boom/` is the actual product: a Vite + React UI served from a
  Cloudflare Worker, with live multiplayer rooms on Durable Objects
  (hibernatable WebSockets). All dev/lint/test/build/run work happens here.
- The root-level Python files (`autotrain.py`, `stats.py`, `train.py`, `test1.py`,
  `winlaunch.py`) are an unrelated, abandoned League-of-Legends OCR/training
  experiment. They require a GUI desktop (X11/`xdotool`), a running game client,
  `tesseract`, `tensorflow`/`torch`, and gitignored training data that is not in
  the repo, so they are not runnable in this headless environment and are not the
  product. Ignore them unless explicitly asked.

## Cursor Cloud specific instructions

Everything below runs inside `two-rooms-and-a-boom/`. Standard scripts live in
`two-rooms-and-a-boom/package.json` (`dev`, `build`, `lint`, `test`,
`test:print`, `test:multiplayer`).

- Node: the project requires Node `>=22.17.0`, but the VM's default `node`
  (`/exec-daemon/node`) is 22.14.0, which is below that floor. Before running any
  `npm`/`vite`/`wrangler` command, select the newer Node with
  `nvm use 22.22.2` (installed via nvm; also set as the nvm default). The update
  script already uses this Node for `npm install`.
- `npm install` runs a full `postinstall` build (`lint` -> `wrangler types` ->
  `tsc -b` -> `vite build`), so a successful install already exercises lint +
  typecheck + build. Expect this on every install.
- Dev server: `npm run dev` starts Vite + the Worker + Durable Objects locally
  and listens on IPv6 `localhost` (`::1`) only, port 5173. Use
  `http://localhost:5173`, not `http://127.0.0.1:5173` (IPv4 connections are
  refused).
- `npm run test:multiplayer` is an end-to-end test that talks to a **running**
  dev server. Start `npm run dev` in another terminal first, and because it
  defaults to `127.0.0.1`, run it against localhost:
  `BASE_URL=http://localhost:5173 npm run test:multiplayer`.
  `npm run test:print` is standalone and needs no server.
- `npm test` runs lint + print-deck + multiplayer; the multiplayer portion will
  fail unless a dev server is up (see above).
- Deploying (`npm run deploy`) requires Cloudflare auth (`wrangler login`) and is
  not needed for local development/testing.
