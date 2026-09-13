# DES Targeting POC

Two-system concept for PA Consulting's Design, Engineering & Science (DES) division:

- **System 1 — Individual Targeting**: helps a line manager set a realistic, personal target per person.
- **System 2 — Organisational Operating**: tells leadership whether DES is on track to hit its goal (fast-follow, not in this POC yet).

See [`CLAUDE.md`](./CLAUDE.md) for the full spec, locked model logic, and milestone plan.

## Stack

React + Vite + TypeScript, one app, one top-level switcher between System 1 and System 2. State: Zustand (`persist` → localStorage, one key per system). Routing: React Router.

## Getting started

```bash
npm install
npm run dev
```

- `npm run build` — production build (`tsc -b && vite build`)
- `npm run lint` — ESLint
