# Correlation Dashboard (FX)

Monorepo with backend (Express + WebSocket + TypeScript) and frontend (Next.js + Tailwind + Chart.js).

## Structure
- backend/ - API + WS streaming, Pearson correlation job
- frontend/ - Next.js dashboard consuming WS/REST

## Setup
```
cd backend
npm install
cp .env.example .env
npm run dev
```

In another terminal:
```
cd ../frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Backend defaults: `PORT=4000`, `WS_PATH=/ws`. Frontend expects `NEXT_PUBLIC_WS_URL=ws://localhost:4000/ws`.

Use Redis (optional):
- set `REDIS_URL=redis://localhost:6379` (and optional `REDIS_NAMESPACE=prices`)
- install Redis client in backend: `npm install ioredis`
- repo switches automatically when `REDIS_URL` is set

## Run
- Backend dev: `npm run dev`
- Frontend dev: `npm run dev`

## Deploy
- Containerize each service; run backend behind reverse proxy with TLS.
- Use PM2/systemd for backend, `next start` or static export if suitable.
- For persistence, replace `InMemoryPriceRepo` with DB/Redis implementation.
