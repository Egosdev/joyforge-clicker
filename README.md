# Joyforge Multiplayer Clicker (MVP)

Monorepo:
- `apps/api` (Node + Express + Socket.IO)
- `apps/worker` (Redis snapshot publisher + Postgres flush)
- `apps/frontend` (React + Tailwind)
- `packages/shared` (paylaşılan TS tipleri)

## Özellikler
- Username + password register/login (Argon2id)
- Cookie tabanlı server-side session (Redis store), TTL 7 gün
- Click endpoint (`POST /click`) 20 click/sn limit
- Click: oyuncu +$1, varsa guild vault +$1
- Guild goal: her click +1 progress (100..300), tamamlanınca score +1, yeni hedef set edilir (progress clamp)
- Leaderboard: Top 100, Socket.IO ile ~1s snapshot
- Case-insensitive unique: username ve guild adı (`*_lower` unique)

## Redis/DB Tasarım Notu
- Redis: hot state (usd/clicks/vault/goal)
- Postgres: kalıcılık
- Worker: `dirty:*` setlerinden batch flush

## Local çalıştırma (host dosyası ile)
1) `/etc/hosts` içine ekle:
```
127.0.0.1 joyforge.local
127.0.0.1 api.joyforge.local
```
2) `docker-compose.yml` içindeki şu alanları local'e göre değiştir:
- `NODE_ENV: "development"` (API/worker için)
- `PUBLIC_APP_ORIGIN: "http://joyforge.local"`
- `COOKIE_DOMAIN: ".joyforge.local"`
- `frontend.build.args.VITE_API_URL: "http://api.joyforge.local"`
- `frontend.build.args.VITE_WS_URL: "http://api.joyforge.local"`

3) Çalıştır:
```
docker compose up --build
```
4) Aç:
- Frontend: `http://joyforge.local`
- API health: `http://api.joyforge.local/health`

## Prod notu
- TLS için Nginx + Let's Encrypt (certbot) ekleyin ve `listen 443 ssl;` ile hostlara sertifika tanımlayın.
- `SESSION_SECRET` mutlaka güçlü bir değer olmalı.

## Endpoint özeti
- `POST /auth/register` `{username,password}`
- `POST /auth/login` `{username,password}`
- `POST /auth/logout`
- `GET /me`
- `POST /click`
- `POST /guilds` `{name}`
- `GET /guilds/me`
- `POST /guilds/invites` `{targetUsername}` (owner)
- `GET /guilds/invites`
- `POST /guilds/invites/:id/approve`
- `POST /guilds/invites/:id/reject`
- `POST /guilds/leave`
- `GET /leaderboard/players`
- `GET /leaderboard/guilds`

## Socket.IO
- Client -> `subscribe` `{channel: 'lb:players'|'lb:guilds'}`
- Server -> `lb:snapshot` `{channel,ts,items}`
